import { randomUUID } from 'node:crypto';
import { getStore, StoreError } from './store.mjs';
export const FORMA_CHAT_WORKSPACE = process.env.FORMA_CHAT_WORKSPACE || process.cwd();

export function queueTaskChat(taskId, version, store = getStore()) {
  const task = store.get(taskId);
  if (task.chatUrl) return {status:'completed',chatUrl:task.chatUrl,taskId};
  if (task.version !== version) throw new StoreError('This task changed. Refresh before creating its chat.',409);
  let command;
  store.saveControlState(state => {
    command = state.commands.find(c => c.type === 'chat' && c.taskId === taskId && ['queued','processing'].includes(c.status));
    if (command) return state;
    const retry = [...state.commands].reverse().find(c => c.type === 'chat' && c.taskId === taskId && c.status === 'failed' && c.threadId);
    if (retry) { command = retry; command.status = 'queued'; delete command.error; return state; }
    if (state.commands.filter(c=>c.status==='queued').length >= 5) throw new StoreError('Wait for queued requests to finish.',409);
    command = {id:randomUUID(),type:'chat',taskId,status:'queued',cwd:FORMA_CHAT_WORKSPACE,createdAt:new Date().toISOString()};
    state.commands=[...state.commands.slice(-99),command]; return state;
  });
  return command;
}

export function attachTaskChat(taskId, threadId, store = getStore()) {
  const current = store.get(taskId);
  if (current.chatUrl) return current;
  return store.update(taskId,{chatUrl:`codex://threads/${threadId}`},current.version);
}
