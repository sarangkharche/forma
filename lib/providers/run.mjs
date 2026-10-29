import { spawn as spawnProcess, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { cliAdapters, providerInfo } from './index.mjs';
const execute = promisify(execFile);
export async function checkClaude() {
  const { stdout } = await execute('claude', ['--help'], { timeout: 10000, maxBuffer: 256000 });
  for (const flag of ['--safe-mode','--restricted','--setting-sources','--strict-mcp-config','--permission-prompts','--tools']) {
    if (!stdout.includes(flag)) throw new Error(`Update Claude Code: required option ${flag} is unavailable.`);
  }
}
// Only the adapter can choose the executable and flags. Never accept a shell command from a task.
export function startProviderRun({ provider = 'codex', prompt, cwd, onUpdate = () => {}, spawn = spawnProcess, timeoutMs = 900000, killGraceMs = 1000 }) {
  providerInfo(provider);
  const adapter = cliAdapters[provider];
  const child = spawn(adapter.command, adapter.args, { cwd, detached: process.platform !== 'win32', stdio: ['pipe','pipe','pipe'] });
  let text = '', sessionId, failure = '', completed = false, verifiedTools = false, settled = false, bytes = 0, timer, escalation;
  function terminate(message) {
    failure ||= message;
    const signal = name => { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, name); else child.kill(name); } catch { /* Already exited. */ } };
    signal('SIGTERM');
    escalation ||= setTimeout(() => signal('SIGKILL'), killGraceMs);
    escalation.unref?.();
  }
  const done = new Promise((resolve, reject) => {
    const fail = error => { if (settled) return; settled = true; clearTimeout(timer); reject(error); };
    child.on('error', error => fail(new Error(`${adapter.command}: ${error.message}`)));
    const lines = createInterface({ input: child.stdout });
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 2_000_000) terminate('Provider output exceeded the limit.'); });
    child.stderr.on('data', () => {}); // Never expose arbitrary diagnostic output or credentials.
    lines.on('line', line => {
      if (failure) return;
      let event; try { event = JSON.parse(line); } catch { terminate('Provider returned malformed JSON output.'); return; }
      let update;
      try {
        update = adapter.parse(event);
        if ((update.text !== undefined && typeof update.text !== 'string') || (update.sessionId !== undefined && typeof update.sessionId !== 'string')) throw new Error('Invalid event fields.');
      } catch { terminate('Provider returned an unsupported event.'); return; }
      if (update.error) { terminate(String(update.error).slice(0,500)); return; }
      if (update.verifiedTools) verifiedTools = true;
      if (update.sessionId) sessionId = update.sessionId;
      if (update.text) text = update.text;
      if (update.completed) completed = true;
      try { onUpdate({ text, sessionId }); } catch { terminate('Could not save provider progress.'); }
    });
    child.on('close', code => {
      clearTimeout(timer);
      // Keep escalation armed to terminate descendants even if the direct child exits first.
      if (settled) return; settled = true;
      if (failure || code !== 0 || !completed || !text || (provider === 'claude' && !verifiedTools)) reject(new Error(failure || `${adapter.command} stopped before a successful result. Check CLI sign in and permissions.`));
      else resolve({ text, sessionId });
    });
  });
  timer = setTimeout(() => terminate('Provider run exceeded the time limit.'), timeoutMs);
  child.stdin.on('error', () => {});
  child.stdin.end(prompt);
  return { child, done, cancel: () => terminate('Run interrupted.') };
}
