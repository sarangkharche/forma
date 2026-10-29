import { randomUUID } from 'node:crypto';
import { getStore, StoreError } from './store.mjs';

export function queueSync(store = getStore()) {
  let command;
  store.saveControlState(state => {
    const active = state.commands.find(c => c.type === 'sync' && ['queued', 'processing', 'submitted'].includes(c.status));
    if (active) { command = active; return state; }
    if (state.commands.filter(c => c.status === 'queued').length >= 5) throw new StoreError('Wait for queued requests to finish.', 409);
    command = { id: randomUUID(), type: 'sync', status: 'queued', createdAt: new Date().toISOString() };
    state.commands = [...state.commands.slice(-99), command];
    return state;
  });
  return command;
}

export function syncPrompt(store) {
  return `Inspect the user's accessible task sources for explicit unfinished actions assigned to them. Verify source identity and ownership, avoid duplicates, and do not change external records or perform tasks. Return a JSON object with tasks, sources and message. Each task needs a stable sourceKey, title and source links. Record honest coverage for granola, slack, jira, codex and calendar, including identity, scope, checkedAt and limitations. Do not import calendar events here. Existing snapshot: ${JSON.stringify(store.snapshot())}`;
}

export function applySyncResult(store, commandId, text) {
  const command = store.controlState().commands.find(item => item.id === commandId && item.type === 'sync');
  if (!command) throw new Error('Unknown sync request.');
  if (command.status === 'completed') return command.result;
  if (!['queued', 'processing', 'submitted'].includes(command.status)) throw new Error('This sync request is no longer active.');
  const batch = JSON.parse(text.trim().replace(/\s*<oai-mem-citation>[\s\S]*<\/oai-mem-citation>\s*$/, '').trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
  if (!Array.isArray(batch.tasks) || typeof batch.message !== 'string' || !batch.sources) throw new Error('Codex returned an incomplete sync batch.');
  for (const name of ['granola', 'slack', 'jira', 'codex', 'calendar']) {
    if (!batch.sources[name] || !['checked','limited','unavailable'].includes(batch.sources[name].status) || typeof batch.sources[name].detail !== 'string') throw new Error(`Codex omitted ${name} coverage.`);
  }
  // Only the ingestion API can change tasks. The agent has no file write access.
  const result = store.ingest({ tasks: batch.tasks, sources: batch.sources, message: batch.message });
  store.saveControlState(state => { const command = state.commands.find(c => c.id === commandId); if (command) Object.assign(command, { status: 'completed', completedAt: new Date().toISOString(), result }); return state; });
  return result;
}
