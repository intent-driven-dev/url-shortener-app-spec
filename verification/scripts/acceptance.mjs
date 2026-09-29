import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { specificationRoot, verificationRoot } from './paths.mjs';
import { generate } from './specs.mjs';

export function inspectReport(report, bindingOnly = false) {
  const scenarios = report.flatMap(f => (f.elements || []).filter(e => e.type === 'scenario'));
  if (!scenarios.length) throw Error('Acceptance report has no scenarios');
  const steps = scenarios.flatMap(s => s.steps || []);
  if (scenarios.some(s => !s.steps?.length)) throw Error('Acceptance report contains empty scenarios');
  const allowed = bindingOnly ? ['skipped', 'passed'] : ['passed'];
  const bad = steps.filter(s => !allowed.includes(s.result?.status));
  if (bad.length) throw Error(`${bindingOnly ? 'Binding validation' : 'Acceptance'} failed: ${bad.map(s => `${s.name || 'hook'} (${s.result?.status || 'missing'})`).join('; ')}`);
  return { scenarios: scenarios.length, steps: steps.length };
}
export async function runAcceptance(root = specificationRoot, change, harnessRoot = verificationRoot) {
  const runDir = path.join(harnessRoot, '.acceptance', new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
  await mkdir(runDir, { recursive: true });
  const features = path.join(runDir, 'features');
  const count = await generate(root, change, features);
  const config = path.join(runDir, 'cucumber.json');
  // An explicit configuration prevents local profiles, tag filters or retries hiding scenarios.
  await writeFile(config, JSON.stringify({ default: {
    paths: [path.relative(harnessRoot, path.join(features, '**/*.feature'))], import: ['acceptance/steps/**/*.mjs', 'acceptance/steps/**/*.js'],
    retry: 0, parallel: 0, strict: true, publish: false
  }}));
  const bin = path.join(harnessRoot, 'node_modules/@cucumber/cucumber/bin/cucumber.js');
  async function execute(dry) {
    const report = path.join(runDir, dry ? 'bindings.json' : 'results.json');
    const args = [bin, '--config', path.relative(harnessRoot, config), '--format', `json:${path.relative(harnessRoot, report)}`, '--format', 'progress'];
    if (dry) args.push('--dry-run');
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: harnessRoot, env: process.env });
      let stdout = '', stderr = '';
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
      child.on('error', reject);
      child.on('close', status => resolve({ status, stdout, stderr }));
    });
    return { result, report };
  }
  console.log(`Acceptance reports: ${runDir}`);
  const binding = await execute(true);
  await writeFile(path.join(runDir, 'bindings.log'), (binding.result.stdout || '') + (binding.result.stderr || ''));
  let bindingReport;
  try { bindingReport = JSON.parse(await readFile(binding.report, 'utf8')); }
  catch { throw Error(`Binding validation failed to produce a report; see ${runDir}/bindings.log`); }
  const planned = inspectReport(bindingReport, true);
  if (planned.scenarios !== count) throw Error('Incomplete acceptance: generated scenarios were omitted');
  if (binding.result.status !== 0) throw Error(`Binding validation failed; see ${runDir}`);
  const actual = await execute(false);
  const log = (actual.result.stdout || '') + (actual.result.stderr || '');
  await writeFile(path.join(runDir, 'execution.log'), log); console.log(log);
  const unavailable = /ECONNREFUSED|ENOTFOUND|fetch failed|ERR_CONNECTION_REFUSED/.test(log + await readFile(actual.report, 'utf8'));
  await writeFile(path.join(runDir, 'summary.json'), JSON.stringify({ change: change || null, expectedScenarios: count, planned, exitCode: actual.result.status, evidence: unavailable ? 'unavailable-application (does not demonstrate exercised behavior)' : 'execution; inspect report for behavior evidence', command: `cd verification && npm test${change ? ` -- --change ${change}` : ''}`, report: actual.report }, null, 2));
  const passed = inspectReport(JSON.parse(await readFile(actual.report, 'utf8')));
  if (actual.result.status !== 0 || passed.scenarios !== planned.scenarios || passed.steps !== planned.steps) throw Error('Incomplete or failed acceptance execution');
  return passed;
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--change')) { console.error('Usage (from verification/): npm test -- [--change <active-name>]'); process.exitCode = 1; }
  else try { await runAcceptance(specificationRoot, args[1]); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
