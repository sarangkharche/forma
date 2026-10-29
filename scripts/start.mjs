import { spawn } from 'node:child_process';
const mode = process.argv.includes('--dev') ? 'dev' : 'start';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', mode, '--hostname', '127.0.0.1', '--port', '5184'], { stdio: 'inherit' });
const workers = new Map(), retries = new Map();
let stopping = false, ready = false;
function startWorker(file, failures = 0) {
  if (stopping) return;
  const child = spawn(process.execPath, [file], { stdio: 'inherit' });
  workers.set(file, child);
  const started = Date.now();
  child.on('exit', () => {
    workers.delete(file);
    if (stopping) return;
    const attempts = Date.now() - started > 60000 ? 0 : failures + 1;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
    console.error(`Forma worker ${file} stopped. Retrying in ${delay / 1000} seconds.`);
    retries.set(file, setTimeout(() => startWorker(file, attempts), delay));
  });
}
const timer = setInterval(async () => {
  if (ready || stopping) return;
  try {
    const response = await fetch('http://127.0.0.1:5184/api/tasks', { signal: AbortSignal.timeout(900) });
    if (!response.ok || !server.pid) return;
    ready = true; clearInterval(timer);
    startWorker('scripts/notification-worker.mjs');
    startWorker('scripts/control-worker.mjs');
  } catch { /* Wait for Next to bind its port. */ }
}, 1000);
function stop(signal = 'SIGTERM') {
  stopping = true; clearInterval(timer);
  for (const retry of retries.values()) clearTimeout(retry);
  for (const child of workers.values()) child.kill(signal);
  server.kill(signal);
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop('SIGINT'));
server.on('exit', code => { stop(); process.exit(code || 0); });
