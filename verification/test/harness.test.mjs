import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, readdir, access, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { parse } from 'yaml';
import { compose, feature, generate } from '../scripts/specs.mjs';
import { inspectReport, runAcceptance } from '../scripts/acceptance.mjs';
import { start, stop, stateDirectory, awaitReady, validateConfig, allocateRuntime, readState, stopBackend, startBackend, owned, disableStorage, restoreStorage } from '../scripts/app.mjs';
import { specificationRoot as root, verificationRoot } from '../scripts/paths.mjs';
const temp = () => mkdtemp(path.join(tmpdir(), 'app-sdd-test-'));
const requirement = (name, scenario = 'example', steps = 'Given a precondition\nWhen an action occurs\nThen a result is visible') => `### Requirement: ${name}\nThe system SHALL work.\n\n#### Scenario: ${scenario}\n\n\`\`\`gherkin\n${steps}\n\`\`\`\n`;
async function put(root, file, text) { const dest = path.join(root, file); await mkdir(path.dirname(dest), { recursive: true }); await writeFile(dest, text); }
function git(cwd, ...args) { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); }
async function listening(server) { await new Promise(r => server.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${server.address().port}`; }

 test('schema enforces ordering, architecture reuse, handoffs, lifecycle and immediate-exit gate', async () => {
  const schema = parse(await readFile(root + 'openspec/schemas/app-level-sdd/schema.yaml', 'utf8'));
  assert.deepEqual(schema.artifacts.map(a => [a.id, a.requires]), [['proposal', []], ['specs', ['proposal']], ['design', ['specs']], ['tasks', ['design']]]);
  for (const artifact of schema.artifacts) assert.ok((await readFile(`${root}openspec/schemas/app-level-sdd/templates/${artifact.template}`, 'utf8')).length);
  const design = schema.artifacts[2].instruction; const tasks = schema.artifacts[3].instruction;
  for (const pattern of [/Reuse accepted decisions/, /every component requires a user-provided Git repository/i, /Both maintained documents are mandatory/, /supersede prior decisions/]) assert.match(design, pattern);
  for (const pattern of [/exactly one Linear child/, /reuse matching component IDs/, /full behavior and Gherkin/, /Todo unless canceled/]) assert.match(tasks, pattern);
  for (const pattern of [/EXIT IMMEDIATELY/, /clear a stale gate/, /CURRENT Linear status/, /retain In Progress/, /never post duplicates/]) assert.match(schema.apply.instruction, pattern);
  const config = parse(await readFile(root + 'openspec/config.yaml', 'utf8'));
  assert.equal(config.schema, 'app-level-sdd'); assert.match(config.operations.archive.guidance.join(' '), /explicit human acceptance/);
});

test('delta composition preserves unaffected requirements, replaces full modifications, adds/removes/renames', () => {
  const base = '## Requirements\n' + requirement('keep') + requirement('old') + requirement('remove') + requirement('modify');
  const delta = '## RENAMED Requirements\n- FROM: `### Requirement: old`\n- TO: `### Requirement: new`\n## MODIFIED Requirements\n' + requirement('modify', 'changed') + '## ADDED Requirements\n' + requirement('added') + '## REMOVED Requirements\n### Requirement: remove\n**Reason**: retired\n**Migration**: none\n';
  const result = compose(base, delta);
  assert.deepEqual([...result.keys()].sort(), ['added', 'keep', 'modify', 'new']);
  assert.match(result.get('modify'), /changed/); assert.equal(feature('sample', result).count, 4);
  assert.throws(() => compose(base, '## ADDED Requirements\n' + requirement('keep')), /Already exists/);
  assert.throws(() => compose(base, '## MODIFIED Requirements\n' + requirement('missing')), /Unknown requirement/);
});

test('extraction keeps multiple scenarios, outlines, tables and doc strings; rejects missing fences', () => {
  const body = requirement('behavior') + '\n#### Scenario: second\n```gherkin\nGiven input\n  """\n  text\n  """\nThen output\n```\n#### Scenario: outline\n```gherkin\nGiven number <n>\nThen output\nExamples:\n | n |\n | 1 |\n | 2 |\n```\n';
  const result = feature('nested/capability', compose(body, ''));
  assert.equal(result.count, 3); assert.match(result.output, /Scenario Outline:/); assert.match(result.output, /"""/);
  assert.throws(() => feature('bad', new Map([['bad', '#### Scenario: missing\nGiven nothing']])), /Gherkin block/);
});

test('generation includes canonical and only selected change, excludes archives and unrelated changes', async () => {
  const dir = await temp();
  await put(dir, 'openspec/specs/nested/a/spec.md', requirement('canonical'));
  await put(dir, 'openspec/changes/selected/specs/b/spec.md', '## ADDED Requirements\n' + requirement('selected'));
  await put(dir, 'openspec/changes/unrelated/specs/c/spec.md', '## ADDED Requirements\n' + requirement('unrelated'));
  await put(dir, 'openspec/changes/archive/old/specs/d/spec.md', requirement('archived'));
  assert.equal(await generate(dir, 'selected', path.join(dir, 'generated')), 2);
  assert.deepEqual(await readdir(path.join(dir, 'generated')), ['b', 'nested']);
  await assert.rejects(generate(dir, '../archive', path.join(dir, 'generated')), /active change/);
  await assert.rejects(generate(await temp(), undefined, path.join(dir, 'empty')), /empty/);
});

test('report validation rejects empty, skipped, pending, undefined and ambiguous execution', () => {
  assert.throws(() => inspectReport([]), /no scenarios/);
  for (const status of ['skipped', 'pending', 'undefined', 'ambiguous', 'failed', undefined]) {
    const report = [{ elements: [{ type: 'scenario', steps: [{ name: 'test', result: { status } }] }] }];
    assert.throws(() => inspectReport(report), /failed/);
  }
});

async function acceptanceFixture(steps, scenarioSteps = 'Given a precondition\nWhen an action occurs\nThen a result is visible') {
  const dir = await temp();
  const harness = path.join(dir, 'verification');
  await mkdir(harness);
  await symlink(path.join(verificationRoot, 'node_modules'), path.join(harness, 'node_modules'), 'dir');
  await put(harness, 'package.json', '{"type":"module"}');
  await put(dir, 'openspec/specs/sample/spec.md', requirement('sample', 'example', scenarioSteps));
  await put(harness, 'acceptance/steps/steps.mjs', steps);
  return dir;
}
const definitions = `import { Given, When, Then } from '@cucumber/cucumber';\nimport assert from 'node:assert/strict';\n`;
test('Cucumber validates downstream bindings before running any steps', async () => {
  const dir = await acceptanceFixture(definitions + `Given('a precondition', () => { throw Error('must not execute'); });`);
  await assert.rejects(runAcceptance(dir, undefined, path.join(dir, 'verification')), /Binding validation failed/);
  const runs = await readdir(path.join(dir, 'verification', '.acceptance'));
  await assert.rejects(access(path.join(dir, 'verification', '.acceptance', runs[0], 'results.json')));
});

test('Cucumber rejects ambiguous bindings and pending placeholders', async () => {
  let dir = await acceptanceFixture(definitions + `Given('a precondition', () => {}); Given('a precondition', () => {});`, 'Given a precondition');
  await assert.rejects(runAcceptance(dir, undefined, path.join(dir, 'verification')), /Binding validation failed/);
  dir = await acceptanceFixture(definitions + `Given('a precondition', () => 'pending');`, 'Given a precondition');
  await assert.rejects(runAcceptance(dir, undefined, path.join(dir, 'verification')), /Acceptance failed/);
});

test('unavailable application is genuine failing evidence with bound downstream steps', async () => {
  const server = createServer(); const url = await listening(server); await new Promise(r => server.close(r));
  const dir = await acceptanceFixture(definitions + `Given('a precondition', async () => { await fetch('${url}'); }); When('an action occurs', () => {}); Then('a result is visible', () => assert.ok(true));`);
  await assert.rejects(runAcceptance(dir, undefined, path.join(dir, 'verification')), /Acceptance failed/);
  const runs = await readdir(path.join(dir, 'verification', '.acceptance'));
  const summary = JSON.parse(await readFile(path.join(dir, 'verification', '.acceptance', runs[0], 'summary.json')));
  assert.match(summary.evidence, /unavailable-application/); assert.equal(summary.planned.steps, 3);
});

test('acceptance can target an already-running API and pass real assertions', async () => {
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"ready":true}'); });
  const url = await listening(server);
  try {
    const dir = await acceptanceFixture(definitions + `Given('a precondition', async function () { this.response = await fetch('${url}'); }); When('an action occurs', async function () { this.body = await this.response.json(); }); Then('a result is visible', function () { assert.equal(this.response.status, 200); assert.equal(this.body.ready, true); });`);
    assert.deepEqual(await runAcceptance(dir, undefined, path.join(dir, 'verification')), { scenarios: 1, steps: 3 });
  } finally { await new Promise(r => server.close(r)); }
});

test('readiness checks retry, timeout and detect early exit', async () => {
  const server = createServer((req, res) => { res.statusCode = 503; res.end(); }); const url = await listening(server);
  try {
    await assert.rejects(awaitReady({ url, timeoutMs: 150 }), /timeout/);
    await assert.rejects(awaitReady({ url, timeoutMs: 150 }, async () => true), /exited/);
  } finally { await new Promise(r => server.close(r)); }
  assert.throws(() => validateConfig({ components: [] }), /unconfigured/);
});

test('temporary checkouts, pinned/default revisions, real passing API acceptance and owned-process cleanup', async () => {
  const repository = await temp(); const owner = await temp();
  await put(repository, 'server.cjs', `require('node:http').createServer((req,res) => { res.setHeader('Content-Type','application/json'); res.end('{"ready":true}'); }).listen(Number(process.env.PORT), '127.0.0.1');`);
  git(repository, 'init'); git(repository, 'add', '.'); git(repository, '-c', 'user.name=Harness Test', '-c', 'user.email=harness@example.invalid', 'commit', '-m', 'fixture');
  const revision = git(repository, 'rev-parse', 'HEAD');
  const reservation = createServer(); const url = await listening(reservation); const port = reservation.address().port; await new Promise(r => reservation.close(r));
  const component = { id: 'fixture', repository, install: 'node --version', start: 'node server.cjs', env: { PORT: String(port) }, readiness: { url, timeoutMs: 3000 } };
  let state;
  try {
    state = await start({ components: [component] }, owner);
    assert.equal(state.components[0].revision, revision); assert.ok(state.workspace.startsWith(tmpdir())); assert.notEqual(state.components[0].checkout, repository);
    const dir = await acceptanceFixture(definitions + `Given('a precondition', async function () { this.response = await fetch('${url}'); }); When('an action occurs', async function () { this.body = await this.response.json(); }); Then('a result is visible', function () { assert.equal(this.response.status, 200); assert.equal(this.body.ready, true); });`);
    assert.deepEqual(await runAcceptance(dir, undefined, path.join(dir, 'verification')), { scenarios: 1, steps: 3 });
  } finally { await stop(owner); }
  await assert.rejects(fetch(url));
  const external = createServer((req,res) => res.end('external')); const externalUrl = await listening(external);
  try {
    state = await start({ components: [{ ...component, revision }] }, owner);
    assert.equal(state.components[0].requestedRevision, revision); await stop(owner);
    assert.equal((await fetch(externalUrl)).status, 200);
  } finally { await stop(owner); await new Promise(r => external.close(r)); }
  const bad = { ...component, id: 'bad', readiness: { url: url + '/never', status: 201, timeoutMs: 150 } };
  await assert.rejects(start({ components: [bad] }, owner), /timeout/);
  await assert.rejects(fetch(url)); await assert.rejects(access(path.join(stateDirectory(owner), 'state.json')));
  await assert.rejects(start({ components: [{ ...component, id: 'exits', start: 'node -e "process.exit(2)"' }] }, owner), /exited/);
  await assert.rejects(start({ components: [{ ...component, install: 'node -e "process.exit(2)"' }] }, owner), /installation failed/);
  await assert.rejects(start({ components: [component, { ...component, id: 'second', install: 'node -e "process.exit(2)"' }] }, owner), /installation failed/);
  await assert.rejects(fetch(url));
  await assert.rejects(start({ components: [{ ...component, install: 'node -e "setInterval(() => {}, 1000)"', installTimeoutMs: 100 }] }, owner), /install timed out/);
  await assert.rejects(access(path.join(stateDirectory(owner), 'state.json')));
});

test('empty outlines and malformed Gherkin cannot silently omit acceptance', () => {
  assert.throws(() => feature('empty-outline', compose(requirement('empty', 'outline', 'Given value <n>\nThen output\nExamples:\n | n |'), '')), /Incomplete scenario/);
  assert.throws(() => feature('invalid', compose(requirement('invalid', 'bad', 'Given input\n | a | b |\n | c |'), '')), /Invalid Gherkin/);
});

test('OpenSpec CLI observes the sequential artifact graph in a temporary fixture', async () => {
  const { cp } = await import('node:fs/promises');
  const dir = await temp();
  await cp(path.join(root, 'openspec/schemas'), path.join(dir, 'openspec/schemas'), { recursive: true });
  await put(dir, 'openspec/config.yaml', 'schema: app-level-sdd\n');
  await put(dir, 'openspec/changes/fixture/.openspec.yaml', 'schema: app-level-sdd\ncreated: 2026-09-29\n');
  const cli = (...args) => {
    const r = spawnSync('openspec', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
    assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
  };
  let status = cli('status', '--change', 'fixture', '--json');
  assert.equal(status.artifacts.find(a => a.id === 'proposal').status, 'ready');
  assert.equal(status.artifacts.find(a => a.id === 'design').status, 'blocked');
  await put(dir, 'openspec/changes/fixture/proposal.md', '## Why\nFixture\n');
  status = cli('status', '--change', 'fixture', '--json');
  assert.equal(status.artifacts.find(a => a.id === 'specs').status, 'ready');
  assert.equal(status.artifacts.find(a => a.id === 'design').status, 'blocked');
  await put(dir, 'openspec/changes/fixture/specs/example/spec.md', '## ADDED Requirements\n' + requirement('fixture'));
  status = cli('status', '--change', 'fixture', '--json');
  assert.equal(status.artifacts.find(a => a.id === 'design').status, 'ready');
  assert.equal(status.artifacts.find(a => a.id === 'tasks').status, 'blocked');
  await put(dir, 'openspec/changes/fixture/design.md', 'Fixture design\n');
  status = cli('status', '--change', 'fixture', '--json');
  assert.equal(status.artifacts.find(a => a.id === 'tasks').status, 'ready');
  await put(dir, 'openspec/changes/fixture/tasks.md', '- [ ] 1.1 Fixture task\n');
  assert.match(cli('instructions', 'apply', '--change', 'fixture', '--json').instruction, /EXIT IMMEDIATELY/);
});

test('repository layout isolates all verification tooling', async () => {
  assert.deepEqual((await readdir(root)).filter(name => name !== '.git').sort(),
    ['.agents', 'AGENTS.md', 'README.md', 'architecture', 'openspec', 'verification']);
  for (const name of ['package.json', 'package-lock.json', 'scripts', 'acceptance', 'test', '.gitignore']) {
    await access(path.join(verificationRoot, name));
  }
  assert.deepEqual((await readFile(path.join(verificationRoot, '.gitignore'), 'utf8')).trim().split('\n'), ['node_modules/', '.acceptance/']);
});

test('CLI discovers specifications and contains reports independently of working directory', async () => {
  const { cp } = await import('node:fs/promises');
  const dir = await acceptanceFixture(definitions + `Given('a precondition', () => assert.equal(2 + 2, 4));`, 'Given a precondition');
  const harness = path.join(dir, 'verification');
  await cp(path.join(verificationRoot, 'scripts'), path.join(harness, 'scripts'), { recursive: true });
  // A misleading spec inside the harness must not become an acceptance input.
  await put(harness, 'openspec/specs/wrong/spec.md', requirement('wrong'));
  for (const cwd of [dir, harness, await temp()]) {
    const run = spawnSync(process.execPath, [path.join(harness, 'scripts/acceptance.mjs')], { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr + run.stdout);
  }
  await assert.rejects(access(path.join(dir, '.acceptance')));
  const runs = await readdir(path.join(harness, '.acceptance'));
  assert.equal(runs.length, 3);
  for (const run of runs) {
    const reportDir = path.join(harness, '.acceptance', run);
    const summary = JSON.parse(await readFile(path.join(reportDir, 'summary.json')));
    assert.equal(summary.expectedScenarios, 1);
    assert.equal(await realpath(path.dirname(summary.report)), await realpath(reportDir));
    assert.deepEqual(await readdir(path.join(reportDir, 'features')), ['sample']);
  }
});

test('startup defaults share repository identity from any working directory', async () => {
  const { pathToFileURL } = await import('node:url');
  const script = `import { stateDirectory } from ${JSON.stringify(pathToFileURL(path.join(verificationRoot, 'scripts/app.mjs')).href)}; console.log(stateDirectory());`;
  for (const cwd of [root, verificationRoot, await temp()]) {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), stateDirectory(root));
  }
  assert.notEqual(stateDirectory(await temp()), stateDirectory(root));
});

test('supporting skills have valid metadata, accessible assets and explicit schema routes', async () => {
  const schema = parse(await readFile(path.join(root, 'openspec/schemas/app-level-sdd/schema.yaml'), 'utf8'));
  const routes = { specs: ['gherkin'], design: ['boundary-clarification', 'adrs'], tasks: ['acceptance-testing'], apply: ['acceptance-testing'] };
  for (const name of new Set(Object.values(routes).flat())) {
    const folder = path.join(root, '.agents/skills', name);
    const text = await readFile(path.join(folder, 'SKILL.md'), 'utf8');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
    assert.ok(front, name);
    const metadata = parse(front[1]);
    assert.equal(metadata.name, name); assert.ok(metadata.description.trim());
    for (const [, target] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (!target.startsWith('https://')) await access(path.resolve(folder, target));
    }
  }
  for (const [stage, skills] of Object.entries(routes)) {
    const instruction = stage === 'apply' ? schema.apply.instruction : schema.artifacts.find(a => a.id === stage).instruction;
    for (const skill of skills) assert.ok(instruction.includes(`.agents/skills/${skill}/SKILL.md`));
  }
});

test('empty-spec CLI and unconfigured configuration guards give actionable errors', () => {
  assert.throws(() => validateConfig({ components: [] }), /unconfigured.*verification\/scripts\/app.mjs/);
  for (const [script, args, message] of [
    ['acceptance.mjs', [], /empty.*Author spec.md/],

  ]) {
    const run = spawnSync(process.execPath, [path.join(verificationRoot, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1); assert.match(run.stderr, message);
  }
});


test('delta parsing rejects every malformed rename and unsupported operation section', () => {
  const base = requirement('old') + requirement('other');
  const valid = '## RENAMED Requirements\n- FROM: `### Requirement: old`\n- TO: `### Requirement: new`\n';
  for (const bad of [
    '- FROM: `### Requirement: other`\n',
    '- TO: `### Requirement: other`\n',
    '- FROM: other\n- TO: broken\n',
    '- FROM: `### Requirement: other`\n- FROM: `### Requirement: third`\n',
    '## REPLACED Requirements\n',
    '## UNSUPPORTED Requirements\n' + requirement('ignored')
  ]) assert.throws(() => compose(base, valid + bad), /Malformed RENAMED|Unsupported operation/);
  assert.throws(() => compose(base, '## RENAMED Requirements\n'), /Malformed RENAMED/);
  const fake = '- FROM: `### Requirement: old`\n- TO: `### Requirement: fake`\n';
  assert.ok(compose(base, '## Notes\n' + fake).has('old'));
  const fenced = '```text\n' + fake + '## UNSUPPORTED Requirements\n```\n';
  assert.ok(compose(base, '## Notes\n' + fenced).has('old'));
  assert.ok(compose(base, valid + fenced).has('new'));
  assert.ok(compose(base, valid + '## MODIFIED Requirements\n' + requirement('new', 'replacement')).get('new').includes('replacement'));
});

test('every Examples block supplies placeholders in steps, tables and doc strings', () => {
  const steps = 'Given value <value>\nAnd details\n | label | <cell> |\nThen document\n """\n <document>\n """\n';
  const examples = 'Examples:\n | value | cell | document |\n | one | two | three |\n';
  const extract = text => feature('outline', compose(requirement('values', 'outline', text), ''));
  assert.equal(extract(steps + examples).executions, 1);
  for (const column of ['value', 'cell', 'document']) {
    assert.throws(() => extract(steps + examples.replace('| ' + column + ' |', '| wrong |')), /Missing Examples columns/);
  }
  assert.throws(() => extract(steps + examples + 'Examples:\n | value |\n | four |\n'), /Missing Examples columns/);
  assert.equal(extract(steps + examples + examples).executions, 2);
});


test('runtime persists origins and storage, ownership rejects foreign restart, cleanup restores outage', async () => {
  const repository = await temp(); const owner = await temp();
  await put(repository, 'server.cjs', `require('node:http').createServer((req,res) => res.end('ready')).listen(Number(process.env.PORT), '127.0.0.1');`);
  git(repository, 'init'); git(repository, 'add', '.');
  git(repository, '-c', 'user.name=Harness Test', '-c', 'user.email=harness@example.invalid', 'commit', '-m', 'fixture');
  const revision = git(repository, 'rev-parse', 'HEAD');
  const component = id => ({ id, repository, revision, install: 'node --version', start: 'node server.cjs', readiness: { url: 'http://127.0.0.1/health', timeoutMs: 3000 } });
  let state;
  try {
    state = await start({ allocateRuntime: true, components: [component('backend'), component('frontend')] }, owner);
    assert.notEqual(state.runtime.backendOrigin, state.runtime.frontendOrigin);
    assert.deepEqual((await readState(owner)).runtime, state.runtime);
    assert.deepEqual(JSON.parse(await readFile(path.join(state.workspace, 'startup.json'))).runtime, state.runtime);
    await mkdir(state.runtime.storageDirectory);
    await writeFile(path.join(state.runtime.storageDirectory, 'retained'), 'unchanged');
    await assert.rejects(startBackend(owner), /already recorded/);
    const active = state.processes.findLast(p => p.id === 'backend' && p.phase === 'start');
    const token = active.token;
    active.token = 'foreign-owner';
    await writeFile(path.join(stateDirectory(owner), 'state.json'), JSON.stringify(state));
    await assert.rejects(stopBackend(owner), /ownership/);
    assert.equal((await fetch(state.runtime.backendOrigin)).status, 200);
    active.token = token;
    await writeFile(path.join(stateDirectory(owner), 'state.json'), JSON.stringify(state));
    await stopBackend(owner);
    assert.equal(owned(active), false);
    await assert.rejects(fetch(state.runtime.backendOrigin));
    await startBackend(owner);
    const restarted = await readState(owner);
    assert.deepEqual(restarted.runtime, state.runtime);
    assert.ok(restarted.processes.at(-1).restartedAt);
    assert.equal((await fetch(state.runtime.backendOrigin)).status, 200);
    await disableStorage(owner);
    await assert.rejects(access(state.runtime.storageDirectory));
    await restoreStorage(owner);
    assert.equal(await readFile(path.join(state.runtime.storageDirectory, 'retained'), 'utf8'), 'unchanged');
    await disableStorage(owner);
  } finally { await stop(owner); }
  assert.equal(await readFile(path.join(state.runtime.storageDirectory, 'retained'), 'utf8'), 'unchanged');
  await assert.rejects(fetch(state.runtime.backendOrigin));
  await assert.rejects(fetch(state.runtime.frontendOrigin));
  await assert.rejects(readState(owner));
  const evidence = JSON.parse(await readFile(path.join(state.workspace, 'startup.json')));
  assert.ok(evidence.stoppedAt);
  assert.ok(evidence.processes.every(p => p.stoppedAt && !owned(p)));
});
