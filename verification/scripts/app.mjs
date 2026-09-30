import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, unlink, open, access, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { createServer } from 'node:net';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { specificationRoot } from './paths.mjs';

// Published deliveries; runtime origins and isolated storage are allocated per run.
export const application = { allocateRuntime: true, components: [
  { id: 'backend', repository: 'https://github.com/intent-driven-dev/url-shortener-be.git',
    revision: '75d3e6c5366c4cd4699c9b3768bc65fad01cad01', install: 'npm ci',
    provision: 'npm run storage:init', start: 'npm start', readiness: { url: 'http://127.0.0.1/health' } },
  { id: 'frontend', repository: 'https://github.com/intent-driven-dev/url-shortener-fe.git',
    revision: '9af081d85d52d010ae9ca3a87d339293044ed7b2', install: 'npm ci',
    start: 'npm start', readiness: { url: 'http://127.0.0.1/health' } }
] };

export async function allocateRuntime(workspace) {
  const reservations = [];
  try {
    for (let i = 0; i < 2; i++) {
      const server = createServer();
      reservations.push(server);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    }
    return { backendOrigin: `http://127.0.0.1:${reservations[0].address().port}`,
      frontendOrigin: `http://127.0.0.1:${reservations[1].address().port}`,
      storageDirectory: path.join(workspace, 'storage') };
  } finally {
    await Promise.all(reservations.filter(s => s.listening).map(s => new Promise(resolve => s.close(resolve))));
  }
}
export function runtimeEnvironment(id, runtime) {
  if (id === 'backend') return { PORT: new URL(runtime.backendOrigin).port,
    PUBLIC_LINK_ORIGIN: runtime.frontendOrigin, STORAGE_DIR: runtime.storageDirectory };
  if (id === 'frontend') return { PORT: new URL(runtime.frontendOrigin).port, BACKEND_ORIGIN: runtime.backendOrigin };
  return {};
}
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
export function owned(p) {
  const result = spawnSync('ps', ['-p', String(p.pid), '-o', 'command='], { encoding: 'utf8' });
  if (result.error || (result.status !== 0 && result.status !== 1)) throw Error('Cannot verify process ownership with ps; refusing to signal processes');
  return result.stdout.includes(helper) && result.stdout.includes(p.token);
}
async function terminate(p) {
  if (!owned(p)) return;
  try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  await sleep(300);
  if (owned(p)) try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  for (let i = 0; i < 50 && owned(p); i++) await sleep(20);
  if (owned(p)) throw Error('Owned process did not exit after termination');
}
export async function stop(root = specificationRoot) {
  const dir = stateDirectory(root); const file = path.join(dir, 'state.json');
  if (!await exists(file)) return;
  const state = JSON.parse(await readFile(file, 'utf8'));
  for (const p of [...state.processes].reverse()) {
    await terminate(p);
    p.stoppedAt ||= new Date().toISOString();
  }
  if (state.runtime && await exists(state.runtime.storageDirectory + '.offline')) await rename(state.runtime.storageDirectory + '.offline', state.runtime.storageDirectory);
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
    if (config.allocateRuntime) state.runtime = await allocateRuntime(state.workspace);
    await save(); process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
    for (const configured of config.components) {
      const c = { ...configured, env: { ...configured.env, ...(state.runtime ? runtimeEnvironment(configured.id, state.runtime) : {}) },
        readiness: state.runtime ? { ...configured.readiness, url: state.runtime[configured.id + 'Origin'] + '/health' } : configured.readiness };
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
      async function runPhase(phase, cmd) {
        const operation = await launch(phase, cmd);
        const deadline = Date.now() + (c.installTimeoutMs ?? 300000);
        while (!await exists(operation.exitFile)) {
          if (interrupted) onSignal();
          if (Date.now() >= deadline) throw Error(`${c.id}: ${phase} timed out`);
          await sleep(50);
        }
        const result = JSON.parse(await readFile(operation.exitFile, 'utf8'));
        await terminate(operation.record);
        operation.record.stoppedAt = new Date().toISOString();
        await save();
        if (result.code !== 0) throw Error(`${c.id}: ${phase === 'install' ? 'dependency installation' : phase} failed; see ${phase} log`);
      }
      await runPhase('install', c.install);
      if (c.provision) await runPhase('provision', c.provision);
      if (interrupted) onSignal();
      const { exitFile } = await launch('start', c.start);
      state.components.push({ id: c.id, repository: c.repository, requestedRevision: c.revision || null, revision, checkout, cwd, install: c.install, start: c.start, provision: c.provision, readiness: c.readiness });
      await save();
      await awaitReady(c.readiness, async () => interrupted || await exists(exitFile));
      state.components.at(-1).readyAt = new Date().toISOString(); await save();
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
export async function readState(root = specificationRoot) {
  return JSON.parse(await readFile(path.join(stateDirectory(root), 'state.json'), 'utf8'));
}
async function saveState(state, root) {
  const data = JSON.stringify(state, null, 2);
  await writeFile(path.join(stateDirectory(root), 'state.json'), data, { mode: 0o600 });
  await writeFile(path.join(state.workspace, 'startup.json'), data, { mode: 0o600 });
}
export async function stopBackend(root = specificationRoot) {
  const state = await readState(root);
  const record = state.processes.findLast(p => p.id === 'backend' && p.phase === 'start' && !p.stoppedAt);
  if (!record || !owned(record)) throw Error('Backend ownership could not be verified; refusing restart control');
  await terminate(record);
  if (owned(record)) throw Error('Backend process did not exit');
  record.stoppedAt = new Date().toISOString();
  await saveState(state, root);
}
export async function startBackend(root = specificationRoot) {
  const state = await readState(root);
  if (state.processes.some(p => p.id === 'backend' && p.phase === 'start' && !p.stoppedAt)) throw Error('Backend is already recorded as running');
  const c = state.components.find(c => c.id === 'backend');
  if (!c || !state.runtime) throw Error('Missing backend restart configuration');
  const token = randomUUID();
  const exitFile = path.join(state.workspace, `backend-restart-${token}-exit.json`);
  const log = await open(path.join(state.workspace, 'backend-start.log'), 'a');
  try {
    const child = spawn(process.execPath, [helper, token, exitFile, c.start], {
      cwd: c.cwd, env: { ...process.env, ...runtimeEnvironment('backend', state.runtime) },
      detached: true, stdio: ['ignore', log.fd, log.fd] });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    state.processes.push({ id: 'backend', phase: 'start', pid: child.pid, token, restartedAt: new Date().toISOString() });
    await saveState(state, root);
    await awaitReady(c.readiness, async () => await exists(exitFile));
  } finally { await log.close(); }
}
export async function disableStorage(root = specificationRoot) {
  const state = await readState(root);
  const directory = state.runtime?.storageDirectory;
  if (!directory || path.dirname(directory) !== state.workspace) throw Error('Storage is not owned by this run');
  if (await exists(directory + '.offline')) throw Error('Storage already offline');
  await rename(directory, directory + '.offline');
  state.storageOfflineAt = new Date().toISOString(); await saveState(state, root);
}
export async function restoreStorage(root = specificationRoot) {
  const state = await readState(root);
  const directory = state.runtime?.storageDirectory;
  if (!directory || path.dirname(directory) !== state.workspace) throw Error('Storage is not owned by this run');
  if (await exists(directory + '.offline')) await rename(directory + '.offline', directory);
  state.storageRestoredAt = new Date().toISOString(); await saveState(state, root);
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'start') await start();
    else if (process.argv[2] === 'stop') await stop();
    else throw Error('Usage (from verification/): node scripts/app.mjs start|stop');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
