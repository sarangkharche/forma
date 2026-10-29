import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createStore } from '../lib/store.mjs';
import { validateClaudeSyncConfig, prepareClaudeSync } from '../lib/providers/claude-sync.mjs';

const fixtureScript = fileURLToPath(new URL('./fixtures/claude-sync-mcp.mjs', import.meta.url));
const now = new Date('2026-10-29T12:00:00Z');
const identityTool = 'mcp__fixture__whoami';
const readTool = 'mcp__fixture__search';
const mutateTool = 'mcp__fixture__mutate';
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'forma-claude-sync-test-'));
  const store = createStore(dir, { seed: false });
  const config = {
    mcpServers: { fixture: { command: process.execPath, args: [fixtureScript], env: { FORMA_FIXTURE_MARKER: join(dir, 'mutations') } } },
    sources: { slack: { expectedIdentity: 'reader@example.com', scope: 'Synthetic work requests', identityTool, readTools: [readTool] } },
    scope: 'Only explicit actions assigned to the verified reader',
  };
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { dir, store, config };
}
function prepare(t) {
  const values = fixture(t);
  const prepared = prepareClaudeSync(values.store, values.config, { now });
  t.after(() => prepared.cleanup());
  return { ...values, prepared };
}
function argument(args, flag) {
  const index = args.indexOf(flag);
  assert.notEqual(index, -1, `Expected ${flag}`);
  return args[index + 1];
}
function jsonArgument(value) { return JSON.parse(value.trim().startsWith('{') ? value : readFileSync(value, 'utf8')); }
function hook(prepared, event, tool, response) {
  const settings = jsonArgument(argument(prepared.args, '--settings'));
  const descriptor = settings.hooks[event][0].hooks[0];
  const payload = { session_id: '11111111-1111-1111-1111-111111111111', cwd: prepared.cwd, hook_event_name: event, tool_name: tool, tool_input: {} };
  if (response !== undefined) payload.tool_response = response;
  return spawnSync(descriptor.command, descriptor.args, { cwd: prepared.cwd, encoding: 'utf8', input: JSON.stringify(payload) });
}
function success(prepared, tool) {
  const response = { content: [{ type: 'text', text: 'Synthetic source response that must stay private.' }], isError: false };
  assert.equal(hook(prepared, 'PreToolUse', tool).status, 0);
  const post = hook(prepared, 'PostToolUse', tool, response);
  assert.equal(post.status, 0, post.stderr);
}
function checkedSource(prepared) { success(prepared, identityTool); success(prepared, readTool); }
function batch(overrides = {}) {
  return { tasks: [{ source: 'slack', sourceKey: 'slack:synthetic:review', title: 'Review synthetic proposal', links: [{ label: 'Source', url: 'https://example.com/synthetic' }] }], sources: { slack: { status: 'checked', identity: 'reader@example.com', identityVerified: true, detail: 'Verified the synthetic explicit request.', checkedAt: now.toISOString() } }, message: 'Checked synthetic work requests.', ...overrides };
}

test('synthetic MCP fixture provides identity, read data and a measurable mutation', t => {
  const { dir } = fixture(t);
  const marker = join(dir, 'fixture-counter');
  const messages = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'forma-test', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'whoami', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search', arguments: {} } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'mutate', arguments: {} } },
  ];
  const run = spawnSync(process.execPath, [fixtureScript], { encoding: 'utf8', env: { ...process.env, FORMA_FIXTURE_MARKER: marker }, input: messages.map(message => JSON.stringify(message)).join('\n') + '\n' });
  assert.equal(run.status, 0, run.stderr);
  const responses = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(responses.map(response => response.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(responses[0].result.capabilities, { tools: { listChanged: false } });
  assert.deepEqual(responses[1].result.tools.map(tool => [tool.name, tool.annotations.readOnlyHint]), [['whoami', true], ['search', true], ['mutate', false]]);
  assert.ok(responses[1].result.tools.every(tool => tool.inputSchema.type === 'object' && tool.inputSchema.additionalProperties === false));
  assert.equal(responses[2].result.structuredContent.identity, 'reader@example.com');
  assert.equal(responses[3].result.structuredContent.tasks[0].sourceKey, 'slack:synthetic:review');
  assert.equal(readFileSync(marker, 'utf8'), '1');
});

test('Claude source sync config accepts exact tools and rejects unbounded source access', t => {
  const { config } = fixture(t);
  assert.doesNotThrow(() => validateClaudeSyncConfig(config));
  for (const change of [
    value => { value.sources.slack.readTools = ['mcp__fixture__*']; },
    value => { value.sources.slack.identityTool = 'mcp__fixture__*'; },
    value => { value.sources.slack.readTools = ['Bash']; },
    value => { value.sources.slack.readTools = ['mcp__other__search']; },
    value => { value.sources.slack.readTools = [identityTool]; },
    value => { value.sources.slack.readTools = []; },
    value => { value.sources.slack.expectedIdentity = ''; },
    value => { value.sources.unknown = value.sources.slack; },
  ]) {
    const invalid = structuredClone(config);
    change(invalid);
    assert.throws(() => validateClaudeSyncConfig(invalid));
  }
  assert.throws(() => validateClaudeSyncConfig([]));
});

test('Claude source sync isolates settings, disables builtins and permits only exact read tools', t => {
  const { dir, prepared } = prepare(t);
  assert.notEqual(prepared.cwd, dir);
  assert.equal(statSync(prepared.cwd).mode & 0o777, 0o700);
  for (const name of ['mcp.json', 'policy.json', 'receipts.jsonl']) assert.equal(statSync(join(prepared.cwd, name)).mode & 0o777, 0o600);
  assert.equal(argument(prepared.args, '--tools'), '');
  assert.equal(argument(prepared.args, '--permission-mode'), 'dontAsk');
  assert.equal(argument(prepared.args, '--permission-prompts'), 'none');
  assert.equal(argument(prepared.args, '--setting-sources'), '');
  assert.ok(prepared.args.includes('--strict-mcp-config'));
  const allowed = argument(prepared.args, '--allowedTools').split(',');
  assert.deepEqual(new Set(allowed), new Set([identityTool, readTool]));
  assert.ok(!allowed.includes(mutateTool));
  const mcp = jsonArgument(argument(prepared.args, '--mcp-config'));
  assert.deepEqual(Object.keys(mcp.mcpServers), ['fixture']);
  const settings = jsonArgument(argument(prepared.args, '--settings'));
  assert.notEqual(settings.disableAllHooks, true);
  assert.ok(settings.hooks.SessionStart.length);
  assert.ok(settings.hooks.PreToolUse.length);
  assert.ok(settings.hooks.PostToolUse.length);
  for (const group of [...settings.hooks.SessionStart, ...settings.hooks.PreToolUse, ...settings.hooks.PostToolUse]) {
    assert.ok(group.hooks.every(hook => hook.type === 'command' && hook.onFailure === 'block'));
  }
  const cwd = prepared.cwd;
  prepared.cleanup();
  assert.equal(existsSync(cwd), false);
});

test('Claude source sync rejects builtin and foreign tool inventories', t => {
  const { prepared } = prepare(t);
  const started = hook(prepared, 'SessionStart');
  assert.equal(started.status, 0, started.stderr);
  assert.equal(prepared.parse({ type: 'system', subtype: 'init', session_id: '11111111-1111-1111-1111-111111111111', tools: [identityTool, readTool, mutateTool] }).verifiedTools, true);
  for (const tools of [['Bash'], ['Read'], ['mcp__other__search'], ['mcp__fixture__search', 'mcp__other__whoami']]) {
    assert.match(prepared.parse({ type: 'system', subtype: 'init', tools }).error, /tool|inventory|outside/i);
  }
  assert.ok(prepared.parse({ type: 'system', subtype: 'init' }).error);
  assert.deepEqual(prepared.parse({ type: 'assistant', message: { content: [{ type: 'text', text: 'Synthetic progress' }] } }), { text: 'Synthetic progress' });
  const terminal = prepared.parse({ type: 'result', subtype: 'success', is_error: false, result: 'Synthetic result' });
  assert.equal(terminal.completed, true);
  assert.equal(terminal.text, 'Synthetic result');
  assert.ok(prepared.parse({ type: 'result', subtype: 'error', is_error: true, result: 'Denied' }).error);
});

test('Claude source sync rejects initialization until the guard startup hook is ready', t => {
  const { prepared } = prepare(t);
  const init = { type: 'system', subtype: 'init', tools: [identityTool, readTool] };
  assert.ok(prepared.parse(init).error);
  const started = hook(prepared, 'SessionStart');
  assert.equal(started.status, 0, started.stderr);
  const receipts = readFileSync(join(prepared.cwd, 'receipts.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].event, 'ready');
  assert.ok(Number.isFinite(Date.parse(receipts[0].at)));
  assert.deepEqual(Object.keys(receipts[0]).sort(), ['at', 'event']);
  assert.equal(prepared.parse(init).verifiedTools, true);
});

test('guard startup fails closed when its policy cannot be loaded', t => {
  const { prepared } = prepare(t);
  writeFileSync(join(prepared.cwd, 'policy.json'), 'not JSON');
  const started = hook(prepared, 'SessionStart');
  assert.equal(started.status, 2);
  assert.equal(readFileSync(join(prepared.cwd, 'receipts.jsonl'), 'utf8'), '');
  assert.ok(prepared.parse({ type: 'system', subtype: 'init', tools: [identityTool, readTool] }).error);
});

test('model source claims without successful tool receipts cannot import tasks', t => {
  const { store, prepared } = prepare(t);
  const checked = prepared.validate(JSON.stringify(batch()));
  assert.equal(checked.sources.slack.status, 'unavailable');
  assert.equal(checked.sources.slack.checkedAt, null);
  assert.deepEqual(checked.tasks, []);
  assert.deepEqual(store.ingest(checked), { added: 0, updated: 0, total: 0 });
});

test('guard denies mutation and builtin tools before they can run', t => {
  const { dir, prepared } = prepare(t);
  for (const tool of [mutateTool, 'Bash', 'Read', 'mcp__other__search', 'mcp__fixture__search*']) {
    const denied = hook(prepared, 'PreToolUse', tool);
    assert.equal(denied.status, 2, `${tool}: ${denied.stderr}`);
  }
  assert.equal(existsSync(join(dir, 'mutations')), false);
  assert.equal(readFileSync(join(prepared.cwd, 'receipts.jsonl'), 'utf8'), '');
});

test('guard receipts require successful permitted reads and contain no source response', t => {
  const { prepared } = prepare(t);
  success(prepared, identityTool);
  success(prepared, readTool);
  for (const tool of [identityTool, readTool]) {
    const failed = hook(prepared, 'PostToolUse', tool, { isError: true, content: [{ type: 'text', text: 'Failed synthetic response' }] });
    assert.equal(failed.status, 0, failed.stderr);
    const failedSnakeCase = hook(prepared, 'PostToolUse', tool, { is_error: true, content: [] });
    assert.equal(failedSnakeCase.status, 0, failedSnakeCase.stderr);
  }
  const denied = hook(prepared, 'PostToolUse', mutateTool, { isError: false, content: [] });
  assert.equal(denied.status, 2);
  const raw = readFileSync(join(prepared.cwd, 'receipts.jsonl'), 'utf8');
  const receipts = raw.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(receipts.length, 2);
  assert.deepEqual(receipts.map(receipt => receipt.tool), [identityTool, readTool]);
  assert.ok(receipts.every(receipt => receipt.event === 'success' && Number.isFinite(Date.parse(receipt.at))));
  assert.ok(receipts.every(receipt => Object.keys(receipt).sort().join(',') === 'at,event,tool'));
  assert.ok(!raw.includes('Synthetic source response'));
  assert.ok(!raw.includes('reader@example.com'));
});

test('guard fails closed if policy is missing or policy and event JSON are malformed', t => {
  const { prepared } = prepare(t);
  const descriptor = jsonArgument(argument(prepared.args, '--settings')).hooks.PreToolUse[0].hooks[0];
  const payload = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: readTool, tool_input: {} });
  const missingArgs = descriptor.args.map(value => value === join(prepared.cwd, 'policy.json') ? join(prepared.cwd, 'missing-policy.json') : value);
  const missing = spawnSync(descriptor.command, missingArgs, { cwd: prepared.cwd, encoding: 'utf8', input: payload });
  assert.equal(missing.status, 2);
  const malformed = spawnSync(descriptor.command, descriptor.args, { cwd: prepared.cwd, encoding: 'utf8', input: 'not JSON' });
  assert.equal(malformed.status, 2);
  writeFileSync(join(prepared.cwd, 'policy.json'), 'not JSON');
  const invalidPolicy = spawnSync(descriptor.command, descriptor.args, { cwd: prepared.cwd, encoding: 'utf8', input: payload });
  assert.equal(invalidPolicy.status, 2);
  assert.equal(readFileSync(join(prepared.cwd, 'receipts.jsonl'), 'utf8'), '');
});

test('a missing tool response cannot create a successful read receipt', t => {
  const { prepared } = prepare(t);
  hook(prepared, 'PostToolUse', identityTool);
  hook(prepared, 'PostToolUse', readTool);
  assert.equal(readFileSync(join(prepared.cwd, 'receipts.jsonl'), 'utf8'), '');
  const checked = prepared.validate(JSON.stringify(batch()));
  assert.equal(checked.sources.slack.status, 'unavailable');
  assert.deepEqual(checked.tasks, []);
});

test('successful identity and read receipts permit a verified source import', t => {
  const { store, prepared } = prepare(t);
  checkedSource(prepared);
  const before = Date.now();
  const checked = prepared.validate(JSON.stringify(batch()));
  const after = Date.now();
  assert.equal(checked.sources.slack.status, 'checked');
  assert.ok(Date.parse(checked.sources.slack.checkedAt) >= before);
  assert.ok(Date.parse(checked.sources.slack.checkedAt) <= after);
  assert.equal(checked.tasks.length, 1);
  assert.deepEqual(store.ingest(checked), { added: 1, updated: 0, total: 1 });
  assert.equal(store.list()[0].title, 'Review synthetic proposal');
});

test('a source is unavailable when identity or read verification is missing', t => {
  for (const tool of [identityTool, readTool]) {
    const { prepared } = prepare(t);
    success(prepared, tool);
    const checked = prepared.validate(JSON.stringify(batch()));
    assert.equal(checked.sources.slack.status, 'unavailable');
    assert.equal(checked.sources.slack.checkedAt, null);
    assert.deepEqual(checked.tasks, []);
  }
});

test('identity mismatch and unverified identity claims cannot import tasks', t => {
  const { prepared } = prepare(t);
  checkedSource(prepared);
  for (const claim of [{ identity: 'someone-else@example.com', identityVerified: true }, { identity: 'reader@example.com', identityVerified: false }, { identityVerified: true }]) {
    const input = batch();
    input.sources.slack = { status: 'checked', detail: 'Claimed identity', checkedAt: now.toISOString(), ...claim };
    const checked = prepared.validate(JSON.stringify(input));
    assert.equal(checked.sources.slack.status, 'unavailable');
    assert.equal(checked.sources.slack.checkedAt, null);
    assert.deepEqual(checked.tasks, []);
  }
});

test('failed source reads cannot establish checked coverage', t => {
  const { prepared } = prepare(t);
  success(prepared, identityTool);
  assert.equal(hook(prepared, 'PostToolUse', readTool, { isError: true, content: [] }).status, 0);
  const checked = prepared.validate(JSON.stringify(batch()));
  assert.equal(checked.sources.slack.status, 'unavailable');
  assert.deepEqual(checked.tasks, []);
});

test('verified sync deduplicates stable keys and preserves human fields and lifecycle', t => {
  const { store, prepared } = prepare(t);
  checkedSource(prepared);
  store.ingest(prepared.validate(JSON.stringify(batch())));
  const original = store.list()[0];
  const human = store.update(original.id, { title: 'Human title', notes: 'Human notes', status: 'done' }, original.version);
  const update = batch();
  Object.assign(update.tasks[0], { title: 'Changed source title', notes: 'Changed source evidence', status: 'todo' });
  const result = store.ingest(prepared.validate(JSON.stringify(update)));
  assert.equal(result.added, 0);
  assert.equal(result.total, 1);
  const task = store.get(original.id);
  assert.equal(task.title, 'Human title');
  assert.equal(task.notes, 'Human notes');
  assert.equal(task.status, 'done');
  assert.equal(task.completedAt, human.completedAt);
  assert.equal(task.sourceNotes, 'Changed source evidence');
});

test('unavailable attempts preserve previous successful coverage and existing tasks', t => {
  const { store, prepared } = prepare(t);
  const previous = '2026-10-28T12:00:00Z';
  store.ingest({ tasks: [{ sourceKey: 'slack:existing', title: 'Existing task' }], sources: { slack: { status: 'checked', checkedAt: previous, detail: 'Previous successful check.' } } });
  store.ingest(prepared.validate(JSON.stringify(batch())));
  const source = store.snapshot().sources.slack;
  assert.equal(source.status, 'unavailable');
  assert.equal(source.checkedAt, null);
  assert.equal(source.lastSuccessfulAt, previous);
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].title, 'Existing task');
});

test('verified imports require primary source links and valid final JSON', t => {
  const { prepared } = prepare(t);
  checkedSource(prepared);
  const noLink = batch();
  noLink.tasks[0].links = [];
  assert.throws(() => prepared.validate(JSON.stringify(noLink)));
  assert.throws(() => prepared.validate('not JSON'));
});

test('unconfigured model source claims cannot create coverage or tasks', t => {
  const { prepared } = prepare(t);
  const claimed = batch({ tasks: [{ source: 'jira', sourceKey: 'jira:synthetic', title: 'Unconfigured task', links: [{ label: 'Source', url: 'https://example.com/jira' }] }], sources: { jira: { status: 'checked', identity: 'reader@example.com', identityVerified: true, detail: 'Claimed access', checkedAt: now.toISOString() } } });
  const checked = prepared.validate(JSON.stringify(claimed));
  assert.deepEqual(checked.tasks, []);
  assert.equal(checked.sources.jira.status, 'unavailable');
});

test('prototype property names do not count as configured task sources', t => {
  const { prepared } = prepare(t);
  checkedSource(prepared);
  const claimed = batch();
  claimed.tasks[0].source = 'constructor';
  assert.deepEqual(prepared.validate(JSON.stringify(claimed)).tasks, []);
});
