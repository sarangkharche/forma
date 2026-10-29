import { syncPrompt, applySyncResult } from './manual-sync.mjs';
import { startProviderRun } from './providers/run.mjs';
export function startSyncRun(store, command, cwd = process.cwd()) {
  const amend = changes => store.saveControlState(state => { const saved = state.commands.find(c => c.id === command.id); if (saved) Object.assign(saved, changes); return state; });
  const run = startProviderRun({ provider: command.provider || 'codex', cwd, prompt: syncPrompt(store), onUpdate: update => {
    if (update.sessionId) amend({ threadId: update.sessionId, status: 'submitted' });
  } });
  run.done.then(result => applySyncResult(store, command.id, result.text)).catch(error => amend({ status: 'failed', error: error.message.slice(0,500) }));
  // Preserve the worker's child handle contract, but cancel the process group on shutdown.
  run.child.cancel = run.cancel;
  return run.child;
}
