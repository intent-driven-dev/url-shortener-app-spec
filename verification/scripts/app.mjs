import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, unlink, open, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { specificationRoot } from './paths.mjs';

// APPLICATION CONFIGURATION — populated by a future feature's apply tasks from
// accepted Design, architecture/components.md and delivered repository instructions.
// No component split is inferred. Commands are trusted shell commands from those
// records. Each entry: { id, repository, revision?, cwd?: '.', install, start,
// env: {}, readiness: { url, status?: 200, timeoutMs?: 60000 } }.
// Omitted revision resolves the remote default branch's commit. Set delivered
// revisions whenever provided. Order entries by their integration dependencies.
export const application = { components: [] };

const helper = fileURLToPath(new URL('./owned-process.mjs', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function stateDirectory(root = specificationRoot) {
  return path.join(tmpdir(), 'app-level-sdd-' + createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 20));
}
export function validateConfig(config) {
  if (!config.components?.length) throw Error('Application startup is unconfigured. Populate application.components in verification/scripts/app.mjs from accepted Design, architecture/components.md and delivered repository instructions after the delivery gate.');
  const ids = new Set();
  for (const c of config.components) {
    if (!/^[a-zA-Z0-9_-]+$/.test(c.id) || ids.has(c.id)) throw Error('Component IDs must be unique and filesystem-safe');
    ids.add(c.id);
    for (const field of ['repository', 'install', 'start']) if (typeof c[field] !== 'string' || !c[field].trim()) throw Error(`${c.id}: missing ${field}`);
    if (c.repository.startsWith('-') || c.revision?.startsWith('-')) throw Error('Repository/revision cannot be a command option');
    if (!/^https?:\/\//.test(c.readiness?.url || '')) throw Error(`${c.id}: provide an HTTP readiness URL`);
    if (c.readiness.timeoutMs !== undefined && !(c.readiness.timeoutMs > 0)) throw Error('Readiness timeout must be positive');
  }
}
function command(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw Error(`${cmd} failed: ${result.error?.message || result.stderr}`);
  return result.stdout.trim();
}
export async function awaitReady(check, failed = async () => false) {
  const deadline = Date.now() + (check.timeoutMs ?? 60000);
  while (Date.now() < deadline) {
    if (await failed()) throw Error(`Component exited before readiness: ${check.url}`);
    try {
      const response = await fetch(check.url, { signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))), redirect: 'manual' });
      await response.body?.cancel();
      if (response.status === (check.status ?? 200)) return;
    } catch { /* Retry connection failures until deadline. */ }
    await sleep(Math.min(100, Math.max(0, deadline - Date.now())));
  }
  throw Error(`Readiness timeout: ${check.url}`);
}
async function exists(file) { try { await access(file); return true; } catch { return false; } }
function owned(p) {
  const result = spawnSync('ps', ['-p', String(p.pid), '-o', 'command='], { encoding: 'utf8' });
  if (result.error || (result.status !== 0 && result.status !== 1)) throw Error('Cannot verify process ownership with ps; refusing to signal processes');
  return result.stdout.includes(helper) && result.stdout.includes(p.token);
}
async function terminate(p) {
  if (!owned(p)) return;
  try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  await sleep(300);
  if (owned(p)) try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
}
export async function stop(root = specificationRoot) {
  const dir = stateDirectory(root); const file = path.join(dir, 'state.json');
  if (!await exists(file)) return;
  const state = JSON.parse(await readFile(file, 'utf8'));
  for (const p of [...state.processes].reverse()) await terminate(p);
  state.stoppedAt = new Date().toISOString();
  await writeFile(path.join(state.workspace, 'startup.json'), JSON.stringify(state, null, 2));
  await unlink(file);
  console.log(`Stopped harness-owned processes. Evidence retained: ${state.workspace}`);
}
export async function start(config = application, root = specificationRoot) {
  validateConfig(config);
  const dir = stateDirectory(root); await mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = await open(path.join(dir, 'start.lock'), 'wx').catch(() => { throw Error(`Startup already in progress; inspect ${dir}/start.lock`); });
  let state;
  const save = async () => {
    // Do not persist environment values, which may include secrets.
    const data = JSON.stringify(state, null, 2);
    await writeFile(path.join(dir, 'state.json'), data, { mode: 0o600 });
    await writeFile(path.join(state.workspace, 'startup.json'), data, { mode: 0o600 });
  };
  const onSignal = () => { throw new Error('Startup interrupted'); };
  // Abort readiness on signals through a flag so cleanup follows the same path.
  let interrupted = false;
  const interrupt = () => { interrupted = true; };
  try {
    if (await exists(path.join(dir, 'state.json'))) throw Error('Harness state already exists. From verification/, run npm run app:stop before starting again.');
    state = { workspace: await mkdtemp(path.join(tmpdir(), 'app-checkout-')), startedAt: new Date().toISOString(), processes: [], components: [] };
    await save(); process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
    for (const c of config.components) {
      if (interrupted) onSignal();
      const checkout = path.join(state.workspace, c.id);
      command('git', ['clone', '--no-checkout', '--', c.repository, checkout]);
      const revision = command('git', ['rev-parse', '--verify', `${c.revision || 'refs/remotes/origin/HEAD'}^{commit}`], checkout);
      command('git', ['checkout', '--detach', revision], checkout);
      const cwd = path.resolve(checkout, c.cwd || '.');
      if (cwd !== checkout && !cwd.startsWith(checkout + path.sep)) throw Error(`${c.id}: cwd escapes checkout`);
      const env = { ...process.env, ...c.env };
      async function launch(phase, cmd) {
        const token = randomUUID();
        const exitFile = path.join(state.workspace, `${c.id}-${phase}-exit.json`);
        const log = await open(path.join(state.workspace, `${c.id}-${phase}.log`), 'a');
        try {
          const child = spawn(process.execPath, [helper, token, exitFile, cmd], { cwd, env, detached: true, stdio: ['ignore', log.fd, log.fd] });
          await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
          child.unref();
          const record = { id: c.id, phase, pid: child.pid, token };
          state.processes.push(record); await save();
          return { record, exitFile };
        } finally { await log.close(); }
      }
      const installation = await launch('install', c.install);
      const deadline = Date.now() + (c.installTimeoutMs ?? 300000);
      while (!await exists(installation.exitFile)) {
        if (interrupted) onSignal();
        if (Date.now() >= deadline) throw Error(`${c.id}: dependency installation timed out`);
        await sleep(50);
      }
      const installResult = JSON.parse(await readFile(installation.exitFile, 'utf8'));
      await terminate(installation.record);
      if (installResult.code !== 0) throw Error(`${c.id}: dependency installation failed; see install log`);
      if (interrupted) onSignal();
      const { exitFile } = await launch('start', c.start);
      state.components.push({ id: c.id, repository: c.repository, requestedRevision: c.revision || null, revision, checkout, cwd, install: c.install, start: c.start, readiness: c.readiness });
      await save();
      await awaitReady(c.readiness, async () => interrupted || await exists(exitFile));
    }
    state.readyAt = new Date().toISOString(); await save();
    console.log(`Application ready. Revisions, commands and logs: ${state.workspace}`); return state;
  } catch (e) {
    if (state) await stop(root);
    throw e;
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await lock.close(); await unlink(path.join(dir, 'start.lock'));
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'start') await start();
    else if (process.argv[2] === 'stop') await stop();
    else throw Error('Usage (from verification/): node scripts/app.mjs start|stop');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
