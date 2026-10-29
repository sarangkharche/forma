// Provider IDs are persisted on requests. Never infer an old run's provider from today's selection.
export const providers = [
  { id: 'codex', label: 'Codex', description: 'Local Codex analysis, saved chats and source tools available to the CLI.' },
  { id: 'claude', label: 'Claude Code', description: 'Local file analysis and resumable sessions. External source connectors are disabled; Sync records coverage gaps.' },
];
export function providerInfo(id = 'codex') {
  const provider = providers.find(value => value.id === id);
  if (!provider) throw new Error('Choose a supported AI provider.');
  return provider;
}
export function selectedProvider(store) { return providerInfo(store.controlState().selectedProvider || 'codex').id; }
export function setProvider(store, id) {
  providerInfo(id);
  store.saveControlState(state => ({ ...state, selectedProvider: id }));
  return { provider: id };
}
export function claudeArgs(sessionId) {
  if (sessionId && !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('Invalid Claude session ID.');
  return ['--print', '--verbose', '--output-format', 'stream-json', '--safe-mode', '--restricted',
    '--setting-sources', '', '--settings', '{"disableAllHooks":true}', '--disable-slash-commands',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', 'Read,Glob,Grep',
    '--allowedTools', 'Read,Glob,Grep', '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
    ...(sessionId ? ['--resume', sessionId] : [])];
}
export function resumeCommand(cwd, sessionId) {
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  // Retain the same tool restrictions when the user resumes outside Forma.
  return `cd ${quote(cwd)} && claude ${claudeArgs(sessionId).filter(value => !['--print','--verbose','stream-json'].includes(value)).filter(value => value !== '--output-format').map(quote).join(' ')}`;
}
export function codexEvent(event) {
  if (event.type === 'thread.started') return { sessionId: event.thread_id };
  if (event.type === 'item.completed' && event.item?.type === 'agent_message') return { text: event.item.text };
  if (event.type === 'turn.completed') return { completed: true };
  if (event.type === 'error' || event.type === 'turn.failed') return { error: event.message || event.error?.message || 'Codex run failed.' };
  return {};
}
export function claudeEvent(event) {
  if (event.type === 'system' && event.subtype === 'init') {
    if (!Array.isArray(event.tools) || event.tools.some(tool => !['Read','Glob','Grep'].includes(tool))) return { error: 'Claude exposed tools outside the configured read tools. Run stopped.' };
    return { sessionId: event.session_id, verifiedTools: true };
  }
  if (event.type === 'assistant') return { text: (event.message?.content || []).filter(value => value.type === 'text').map(value => value.text).join('\n') };
  if (event.type === 'result') return event.is_error || event.subtype !== 'success'
    ? { error: event.errors?.join('\n') || event.result || 'Claude run failed.' }
    : { completed: true, text: event.result, sessionId: event.session_id };
  return {};
}
export const cliAdapters = {
  codex: { command: 'codex', args: ['exec','--json','--sandbox','read-only','--skip-git-repo-check','-'], parse: codexEvent },
  claude: { command: 'claude', args: claudeArgs(), parse: claudeEvent },
};
