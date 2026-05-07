// Spawn Electron with ELECTRON_RUN_AS_NODE removed from the environment.
// Why: if that var is set in the parent shell, Electron starts in Node-only
// mode and require('electron') returns a path string instead of the API,
// causing "Cannot read properties of undefined (reading 'whenReady')".
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const electronPath = require('electron');

const args = process.argv.slice(2);
if (args.length === 0) args.push('.');

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Failed to launch Electron:', err);
  process.exit(1);
});
