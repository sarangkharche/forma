import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { syncPrompt, applySyncResult } from './manual-sync.mjs';

export function startSyncRun(store, command, cwd = process.cwd()) {
  const amend = changes => store.saveControlState(state => { const saved = state.commands.find(c => c.id === command.id); if (saved) Object.assign(saved, changes); return state; });
  const child = spawn('codex', ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', '-C', cwd, '-'], {stdio:['pipe','pipe','ignore']});
  let text = '', failure = '', finished = false;
  const timer = setTimeout(() => { failure = 'Sync exceeded 15 minutes. Open its Codex chat to check the outcome before retrying.'; child.kill(); }, 900000);
  createInterface({input:child.stdout}).on('line', line => {
    let event; try { event = JSON.parse(line); } catch { return; }
    if (event.type === 'thread.started') amend({threadId:event.thread_id,status:'submitted'});
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') text = event.item.text;
    if (event.type === 'error' || event.type === 'turn.failed') failure = event.message || event.error?.message || 'Codex sync failed.';
    if (event.type === 'turn.completed') finished = true;
  });
  child.on('error', error => { clearTimeout(timer); amend({status:'failed',error:error.message.slice(0,500)}); });
  child.on('close', code => {
    clearTimeout(timer);
    try { if (code !== 0 || !finished || !text) throw new Error(failure || 'Codex stopped before returning a sync batch.'); applySyncResult(store,command.id,text); }
    catch (error) { amend({status:'failed',error:error.message.slice(0,500)}); }
  });
  child.stdin.on('error', () => {});
  child.stdin.end(syncPrompt(store));
  return child;
}
