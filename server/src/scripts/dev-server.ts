import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const child = spawn(isWindows ? 'tsx.cmd' : 'tsx', ['watch', 'src/server.ts'], {
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit',
  shell: isWindows,
});

child.once('error', (error: Error) => {
  console.error('Could not start the development server:', error.message);
  process.exitCode = 1;
});

child.once('exit', (code: number | null) => {
  process.exitCode = code ?? 1;
});
