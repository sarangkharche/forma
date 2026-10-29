import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStore } from '../lib/store.mjs';
import { ClaudeRuntime, recoverClaudeRuns } from '../lib/providers/claude-runtime.mjs';
import { prepareClaudeSync, readClaudeSyncConfig } from '../lib/providers/claude-sync.mjs';
import { queueSync } from '../lib/manual-sync.mjs';
import { setProvider } from '../lib/providers/index.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-sync-runtime-')), store = createStore(directory, { seed: false });
  const config = { mcpServers: { fixture: { command: process.execPath, args: [] } }, sources: { slack: { expectedIdentity: 'reader@example.com', scope: 'Synthetic requests', identityTool: 'mcp__fixture__whoami', readTools: ['mcp__fixture__search'] } } };
  const file = join(directory, 'config.json'), previous = process.env.FORMA_CLAUDE_SYNC_CONFIG;
  writeFileSync(file, JSON.stringify(config)); process.env.FORMA_CLAUDE_SYNC_CONFIG = file; setProvider(store, 'claude');
  t.after(() => { if (previous === undefined) delete process.env.FORMA_CLAUDE_SYNC_CONFIG; else process.env.FORMA_CLAUDE_SYNC_CONFIG = previous; store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { directory, store, config, file };
}
function recordReads(prepared) {
  const settings = JSON.parse(prepared.args[prepared.args.indexOf('--settings') + 1]);
  for (const [event, tool] of [['SessionStart',undefined],['PostToolUse','mcp__fixture__whoami'],['PostToolUse','mcp__fixture__search']]) {
    const descriptor = settings.hooks[event][0].hooks[0];
    const result = spawnSync(descriptor.command, descriptor.args, { input: JSON.stringify({ hook_event_name: event, tool_name: tool, tool_response: { content: [], isError: false } }), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
}
const text = JSON.stringify({ tasks: [{ source: 'slack', sourceKey: 'slack:synthetic:one', title: 'Review synthetic proposal', links: [{ label: 'Source', url: 'https://example.com/proposal' }] }], sources: { slack: { status: 'checked', identity: 'reader@example.com', identityVerified: true, detail: 'Synthetic request verified.' } } });

test('Claude runtime applies a verified sync and cleans private run files before closing', async t => {
  const { store } = fixture(t), command = queueSync(store); let cwd;
  const runtime = new ClaudeRuntime(store, { check: async options => assert.equal(options.sourceSync, true), start: options => {
    cwd = options.cwd; recordReads(options.claudeSync); options.onUpdate({ sessionId: '11111111-1111-1111-1111-111111111111' });
    return { done: Promise.resolve({ text }), cancel() {} };
  } });
  await runtime.dispatch(command); await runtime.close();
  assert.equal(store.controlState().commands[0].status, 'completed');
  assert.equal(store.controlState().commands[0].syncDirectory, null);
  assert.equal(store.list().length, 1); assert.equal(existsSync(cwd), false);
});

test('failed and cancelled Claude source runs preserve tasks and clean private files', async t => {
  const { store } = fixture(t); store.create({ title: 'Keep this task' });
  for (const cancel of [false, true]) {
    const command = queueSync(store); let cwd, rejectRun;
    const runtime = new ClaudeRuntime(store, { check: async () => {}, start: options => {
      cwd = options.cwd;
      return { done: cancel ? new Promise((_, reject) => { rejectRun = reject; }) : Promise.resolve({ text: 'not JSON' }), cancel() { rejectRun?.(new Error('Run interrupted.')); } };
    } });
    await runtime.dispatch(command); await runtime.close();
    assert.equal(store.controlState().commands.find(item => item.id === command.id).status, 'failed');
    assert.equal(store.list().length, 1); assert.equal(store.list()[0].title, 'Keep this task'); assert.equal(existsSync(cwd), false);
  }
});

test('worker restart removes private sync material and never retries the lost request', t => {
  const { store, config } = fixture(t), command = queueSync(store), prepared = prepareClaudeSync(store, config);
  store.saveControlState(state => { Object.assign(state.commands[0], { status: 'submitted', syncDirectory: prepared.cwd }); return state; });
  recoverClaudeRuns(store);
  assert.equal(existsSync(prepared.cwd), false);
  assert.equal(store.controlState().commands[0].id, command.id); assert.equal(store.controlState().commands[0].status, 'failed');
  assert.equal(store.controlState().commands[0].syncDirectory, null);
});

test('config errors do not echo secrets and the configuration command writes a private file', t => {
  const { file, directory } = fixture(t), target = join(directory, 'private', 'claude-sync.json');
  const saved = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/configure-claude-sync.mjs', import.meta.url)), file], { env: { ...process.env, FORMA_CLAUDE_SYNC_CONFIG: target }, encoding: 'utf8' });
  assert.equal(saved.status, 0, saved.stderr); assert.equal(statSync(target).mode & 0o777, 0o600); assert.ok(readClaudeSyncConfig(target));
  writeFileSync(file, '{"token":"PRIVATE_TEST_VALUE"');
  assert.throws(() => readClaudeSyncConfig(file), error => !error.message.includes('PRIVATE_TEST_VALUE'));
  assert.equal(readClaudeSyncConfig(join(directory, 'missing.json')), null);
});
