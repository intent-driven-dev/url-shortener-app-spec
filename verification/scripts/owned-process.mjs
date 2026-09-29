// Group leader stays alive after the child exits so its PID cannot be reused
// while descendants still need cleanup. Only app.mjs signals this process group.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [token, exitFile, command] = process.argv.slice(2);
const child = spawn(command, { shell: true, stdio: 'inherit', env: process.env });
child.on('error', e => writeFileSync(exitFile, e.message));
child.on('exit', (code, signal) => writeFileSync(exitFile, JSON.stringify({ code, signal })));
setInterval(() => {}, 1000);
// Keep the leader alive during graceful group termination; the controller then
// sends SIGKILL to the same group, including any descendants ignoring SIGTERM.
process.on('SIGTERM', () => {});
process.on('SIGINT', () => {});
