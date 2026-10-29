import { randomUUID } from 'node:crypto';
import { checkClaude, startProviderRun } from './run.mjs';
import { resumeCommand } from './index.mjs';
import { taskBrief } from '../control.mjs';
import { applySyncResult } from '../manual-sync.mjs';
import { readClaudeSyncConfig, prepareClaudeSync, unavailableClaudeSources, cleanupClaudeSyncDirectory } from './claude-sync.mjs';
export class ClaudeRuntime {
  constructor(store, { check = checkClaude, start = startProviderRun } = {}) { this.store = store; this.check = check; this.start = start; this.runs = new Map(); }
  amend(id, values) { this.store.saveControlState(state => { const command = state.commands.find(c => c.id === id); if (command) Object.assign(command, values); return state; }); }
  agent(id, values) { this.store.saveControlState(state => { const agent = state.agents.find(a => a.id === id); if (agent) Object.assign(agent, values, { updatedAt: new Date().toISOString() }); return state; }); }
  async dispatch(command) {
    if (command.type === 'interrupt') {
      const run = this.runs.get(command.threadId);
      if (!run) throw new Error('This Claude run is no longer controlled by this worker.');
      run.cancel(); this.amend(command.id, { status: 'completed' }); return;
    }
    if (command.type === 'sync') {
      const config = readClaudeSyncConfig();
      if (!config) {
        applySyncResult(this.store, command.id, JSON.stringify({ tasks: [], sources: unavailableClaudeSources(), message: 'Claude source sync is not configured. No source checks or imports were performed. Existing tasks are preserved.' }));
        return;
      }
      await this.check({ sourceSync: true });
      const prepared = prepareClaudeSync(this.store, config);
      try {
        this.amend(command.id, { syncDirectory: prepared.cwd });
        const run = this.start({ provider: 'claude', claudeSync: prepared, cwd: prepared.cwd, prompt: prepared.prompt, onUpdate: update => {
          this.amend(command.id, { status: 'submitted', ...(update.sessionId ? { sessionId: update.sessionId } : {}) });
        } });
        const completion = run.done.then(result => applySyncResult(this.store, command.id, JSON.stringify(prepared.validate(result.text))))
          .catch(error => this.amend(command.id, { status: 'failed', error: error.message.slice(0,500) }))
          .finally(() => { this.runs.delete(command.id); prepared.cleanup(); this.amend(command.id, { syncDirectory: null }); });
        this.runs.set(command.id, { ...run, done: completion });
      } catch (error) { prepared.cleanup(); this.amend(command.id, { syncDirectory: null }); throw error; }
      return;
    }
    await this.check();
    const id = randomUUID(), task = this.store.get(command.taskId);
    const prompt = command.type === 'chat' ? `Acknowledge this saved context only. Do not start work.\n${taskBrief(task, this.store.activity(task.id))}` : command.text;
    const agent = { id, provider: 'claude', title: task.title, taskId: task.id, managed: true, status: 'running', turnId: command.id, cwd: command.cwd, updatedAt: new Date().toISOString(), result: '', evidence: 'Claude Code CLI run managed by Forma.' };
    this.store.saveControlState(state => { state.agents.unshift(agent); return state; });
    this.amend(command.id, { status: 'submitted', threadId: id, turnId: command.id });
    let run;
    try {
      run = this.start({ provider: 'claude', prompt, cwd: command.cwd, onUpdate: update => {
        const values = { progress: update.text };
        if (update.sessionId && /^[0-9a-f-]{36}$/i.test(update.sessionId)) {
          values.sessionId = update.sessionId; values.resumeCommand = resumeCommand(command.cwd, update.sessionId);
          this.amend(command.id, { sessionId: values.sessionId, resumeCommand: values.resumeCommand });
        }
        this.agent(id, values);
      } });
      const completion = run.done.then(result => {
        this.agent(id, { status: 'review', result: result.text, progress: '' });
        this.amend(command.id, { status: 'completed', completedAt: new Date().toISOString() });
      }).catch(error => {
        this.agent(id, { status: error.message === 'Run interrupted.' ? 'interrupted' : 'failed', evidence: error.message });
        this.amend(command.id, { status: 'failed', error: error.message });
      }).finally(() => this.runs.delete(id));
      this.runs.set(id, { ...run, done: completion });
    } catch (error) { this.agent(id, { status: 'failed', evidence: error.message }); throw error; }
  }
  async close() { for (const run of this.runs.values()) run.cancel(); await Promise.allSettled([...this.runs.values()].map(run => run.done)); }
}
export function recoverClaudeRuns(store) {
  store.saveControlState(state => {
    for (const command of state.commands.filter(c => c.provider === 'claude' && c.syncDirectory)) { cleanupClaudeSyncDirectory(command.syncDirectory); command.syncDirectory = null; }
    for (const agent of state.agents.filter(a => a.provider === 'claude' && a.status === 'running')) Object.assign(agent, { status: 'unknown', evidence: 'Worker restarted. This run cannot be reattached; check the saved session before retrying.' });
    for (const command of state.commands.filter(c => c.provider === 'claude' && ['processing','submitted'].includes(c.status))) Object.assign(command, { status: 'failed', error: 'Worker restarted during this Claude request. Check its session before retrying.' });
    return state;
  });
}
