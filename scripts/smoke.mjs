import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStore } from '../lib/store.mjs';
import { backupData, restoreData } from '../lib/backup.mjs';

if (!existsSync(join(process.cwd(), '.next', 'BUILD_ID'))) throw new Error('Build Forma before running the production smoke check.');
const directory = mkdtempSync(join(tmpdir(), 'forma-smoke-')), data = join(directory, 'data'), base = 'http://127.0.0.1:5184';
const binaries = join(directory, 'bin'), unexpectedAi = join(directory, 'unexpected-ai'); mkdirSync(binaries);
for (const cli of ['codex','claude']) writeFileSync(join(binaries, cli), `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(unexpectedAi)},'AI was unexpectedly launched');process.exit(1);\n`, { mode: 0o700 });
const initial = createStore(data, { seed: false }); initial.saveControlState(state => ({ ...state, setup: { aiEnabled: false } })); initial.close();
let server, logs = '';
async function waitFor(work, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await work()) return; await new Promise(resolve => setTimeout(resolve, 150)); }
  throw new Error('Smoke check timed out.');
}
async function start() {
  logs = '';
  server = spawn(process.execPath, ['scripts/start.mjs'], { env: { ...process.env, PATH: `${binaries}:/usr/bin:/bin`, TODOS_DATA_DIR: data, FORMA_CLAUDE_SYNC_CONFIG: join(directory, 'no-sources.json') }, detached: process.platform !== 'win32', stdio: ['ignore','pipe','pipe'] });
  server.stdout.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  await waitFor(async () => {
    if (server.exitCode !== null) throw new Error('Forma could not start. Check that port 5184 is free.');
    if (!logs.includes('Ready in')) return false;
    try { return (await fetch(base + '/api/tasks')).ok; } catch { return false; }
  });
}
async function stop() {
  if (!server) return;
  const child = server; server = null;
  if (child.exitCode !== null) return;
  const closed = once(child, 'close');
  const signal = name => { try { if (process.platform !== 'win32') process.kill(-child.pid, name); else child.kill(name); } catch { /* Already stopped. */ } };
  signal('SIGTERM'); const timer = setTimeout(() => signal('SIGKILL'), 5000);
  await closed; clearTimeout(timer);
}
async function json(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { origin: base, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}.`);
  return response.json();
}
function statusWithHeaders(headers) {
  return new Promise((resolve, reject) => {
    // Node fetch replaces Host with the URL hostname. Use HTTP to test the actual wire header.
    const call = request(base + '/api/tasks', { headers }, response => { response.resume(); resolve(response.statusCode); });
    call.on('error', reject); call.setTimeout(10000, () => call.destroy(new Error('Host check timed out.'))); call.end();
  });
}
try {
  await start(); assert.equal((await json('/api/tasks')).tasks.length, 0);
  assert.equal((await fetch(base + '/api/tasks')).status, 200, 'CLI reads with no Origin must work.');
  assert.equal(await statusWithHeaders({ host: 'localhost:5184', origin: 'http://localhost:5184' }), 200, 'The localhost browser origin must work.');
  assert.equal(await statusWithHeaders({ host: 'untrusted.example:5184' }), 403, 'An untrusted Host must be blocked.');
  assert.equal((await fetch(base + '/api/tasks', { headers: { origin: 'https://example.com' } })).status, 403, 'An untrusted Origin must be blocked.');
  let task = await json('/api/tasks', 'POST', { title: 'Synthetic customer smoke task', notes: 'Saved by the smoke check', priority: 'high' });
  const cliEdit = await fetch(base + '/api/tasks', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: task.id, version: task.version, title: 'Human edited smoke task', status: 'done' }) });
  assert.equal(cliEdit.status, 200); task = await cliEdit.json();
  const inbox = await json('/api/inbox');
  await json('/api/inbox', 'POST', { action: 'preferences', preferences: { ...inbox.preferences, inactivityDays: 5 } });
  const blocked = await fetch(base + '/api/control', { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'provider', provider: 'claude' }) }); assert.equal(blocked.status, 403);
  await waitFor(async () => (await json('/api/control')).backup?.at);
  const file = join(directory, 'backup.sqlite'); await backupData(file, data);
  const restoredPath = join(directory, 'restored'); await restoreData(file, restoredPath);
  const restored = createStore(restoredPath, { seed: false });
  try { assert.equal(restored.get(task.id).title, 'Human edited smoke task'); assert.equal(restored.get(task.id).status, 'done'); assert.equal(restored.inboxState().preferences.inactivityDays, 5); } finally { restored.close(); }
  await stop(); await start();
  assert.equal((await json('/api/tasks')).tasks.find(value => value.id === task.id).title, 'Human edited smoke task');
  await waitFor(async () => (await json('/api/control')).workerAt);
  assert.equal(existsSync(unexpectedAi), false, 'Manual setup must not launch an AI CLI.');
  console.log('Production smoke passed: empty start, task edits, completion, reminder preferences, local request guard, worker backup, restore and restart persistence. No model or source calls were made.');
} catch (error) { console.error(error.message); if (logs) console.error(logs); process.exitCode = 1; }
finally { await stop(); rmSync(directory, { recursive: true, force: true }); }
