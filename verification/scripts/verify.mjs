// Verify a harness-owned live run using its persisted nonsecret runtime configuration.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readState, restoreStorage } from './app.mjs';
import { verificationRoot } from './paths.mjs';
import { verifyBoundaries } from '../acceptance/boundaries.mjs';
import * as controls from '../acceptance/controls.mjs';

const reportDirectory = path.join(verificationRoot, '.acceptance', new Date().toISOString().replaceAll(':', '-') + '-integration');
await mkdir(reportDirectory, { recursive: true });
const report = { startedAt: new Date().toISOString(), checks: [] };
async function npm(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, { cwd: verificationRoot, env, stdio: 'inherit' });
    child.once('error', reject); child.once('close', resolve);
  });
}
try {
  const state = await readState();
  if (!state.readyAt || !state.runtime) throw Error('Run npm run app:start first');
  report.workspace = state.workspace;
  report.runtime = state.runtime;
  report.components = state.components;
  report.acceptanceCommand = 'npm test';
  report.acceptanceExitCode = await npm(['test'], { ...process.env, FRONTEND_ORIGIN: state.runtime.frontendOrigin });
  try {
    await verifyBoundaries({ ...state.runtime, controls, onCheck: name => report.checks.push({ name, status: 'passed' }) });
    report.boundaries = 'passed';
  } catch (error) { report.boundaries = 'failed'; report.boundaryError = error.stack; }
  if (report.acceptanceExitCode !== 0 || report.boundaries !== 'passed') process.exitCode = 1;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  try { await restoreStorage(); }
  catch (error) { report.restoreError = error.message; process.exitCode = 1; }
  try {
    report.cleanupExitCode = await npm(['run', 'app:stop']);
    if (report.cleanupExitCode !== 0) process.exitCode = 1;
  } catch (error) { report.cleanupError = error.message; process.exitCode = 1; }
  report.completedAt = new Date().toISOString();
  await writeFile(path.join(reportDirectory, 'integration.json'), JSON.stringify(report, null, 2));
  console.log(`Integration and cleanup evidence: ${reportDirectory}/integration.json`);
}
