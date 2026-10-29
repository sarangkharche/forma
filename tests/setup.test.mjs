import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createStore } from '../lib/store.mjs';
import { selectedProvider } from '../lib/providers/index.mjs';
import { buildClaudeSyncConfig, saveClaudeSyncConfig, runSetup, collectDiagnostics, parseSetupArgs, setupPaths } from '../lib/setup.mjs';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'forma-setup-'));
  const env = { TODOS_DATA_DIR: join(cwd, 'data') };
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return { cwd, env, log: () => {} };
}
const serverInput = {
  serverName: 'work', url: 'https://mcp.example.test/mcp',
  sources: {
    slack: { expectedIdentity: 'Work account in team', scope: 'Assigned unfinished actions', identityTool: 'identity', readTools: ['search', 'mcp__work__thread'] },
    jira: { expectedIdentity: 'Work Jira account', scope: 'Assigned open tickets', identityTool: 'identity', readTools: ['issue'] },
  },
};
const config = () => buildClaudeSyncConfig(structuredClone(serverInput));
const cli = async (name, args) => {
  if (args[0] === '--version') return { stdout: name === 'claude' ? '2.1.308 (Claude Code)' : 'codex-cli 0.162.1' };
  if (args[0] === 'auth') return { stdout: JSON.stringify({ loggedIn: true, email: 'private@example.test', token: 'secret' }) };
  if (args[0] === 'login') return { stdout: 'Logged in using secret' };
  return { stdout: '--safe-mode --restricted --setting-sources --strict-mcp-config --permission-prompts --tools app-server --stdio --json --sandbox --skip-git-repo-check' };
};

test('fresh noninteractive setup can skip AI without seeding tasks or inventing a provider', async t => {
  const options = fixture(t);
  const result = await runSetup({ ...options, args: ['--noninteractive', '--skip-ai'] });
  assert.equal(result.aiEnabled, false);
  const store = createStore(options.env.TODOS_DATA_DIR, { seed: false });
  try { assert.equal(store.list().length, 0); assert.equal(store.controlState().selectedProvider, undefined); assert.equal(store.controlState().setup.aiEnabled, false); }
  finally { store.close(); }
  assert.equal(existsSync(join(options.env.TODOS_DATA_DIR, 'claude-sync.json')), false);
});

test('provider selection preserves human tasks and unrelated control state', async t => {
  const options = fixture(t);
  let store = createStore(options.env.TODOS_DATA_DIR, { seed: false });
  const task = store.create({ title: 'Keep my task', notes: 'Human notes', status: 'waiting' });
  store.saveControlState(state => ({ ...state, reviewed: { existing: true }, commands: [{ id: 'old', status: 'completed' }] }));
  store.close();
  await runSetup({ ...options, args: ['--provider', 'claude', '--noninteractive'] });
  store = createStore(options.env.TODOS_DATA_DIR, { seed: false });
  try {
    assert.equal(selectedProvider(store), 'claude'); assert.deepEqual(store.get(task.id), task);
    assert.deepEqual(store.controlState().reviewed, { existing: true }); assert.equal(store.controlState().commands.length, 1);
    assert.equal(store.controlState().setup.aiEnabled, true);
  } finally { store.close(); }
});

test('MCP builder prefixes unqualified tools and rejects wildcards or another server', () => {
  const built = config();
  assert.equal(built.sources.slack.identityTool, 'mcp__work__identity');
  assert.deepEqual(built.sources.slack.readTools, ['mcp__work__search', 'mcp__work__thread']);
  assert.equal(Object.keys(built.sources).length, 2);
  for (const tool of ['*', 'search*', 'mcp__other__search']) {
    const input = structuredClone(serverInput); input.sources.slack.readTools = [tool];
    assert.throws(() => buildClaudeSyncConfig(input), /exact|Wildcards/);
  }
  assert.throws(() => buildClaudeSyncConfig({ ...serverInput, url: 'file:///private/config' }), /HTTP/);
});

test('config saving uses private permissions and replacement must be explicit', async t => {
  const options = fixture(t), paths = setupPaths(options), original = config();
  saveClaudeSyncConfig(original, paths.configFile);
  assert.equal(statSync(paths.configFile).mode & 0o777, 0o600);
  assert.equal(statSync(options.env.TODOS_DATA_DIR).mode & 0o777, 0o700);
  const replacement = config(); replacement.sources.slack.scope = 'Replacement scope';
  assert.throws(() => saveClaudeSyncConfig(replacement, paths.configFile), /already exists/);
  assert.deepEqual(JSON.parse(readFileSync(paths.configFile, 'utf8')), original);
  saveClaudeSyncConfig(replacement, paths.configFile, { replace: true });
  assert.deepEqual(JSON.parse(readFileSync(paths.configFile, 'utf8')), replacement);
  assert.equal(statSync(paths.configFile).mode & 0o777, 0o600);
  const source = join(options.cwd, 'import.json'); writeFileSync(source, JSON.stringify(original));
  await assert.rejects(runSetup({ ...options, args: ['--provider', 'claude', '--config', source] }), /already exists/);
  await runSetup({ ...options, args: ['--provider', 'claude', '--config', source, '--replace-config'] });
  assert.deepEqual(JSON.parse(readFileSync(paths.configFile, 'utf8')), original);
});

test('interactive blank source configuration keeps existing private config', async t => {
  const options = fixture(t), paths = setupPaths(options);
  saveClaudeSyncConfig(config(), paths.configFile);
  const before = readFileSync(paths.configFile, 'utf8');
  await runSetup({ ...options, args: ['--provider', 'claude'], ask: async () => '' });
  assert.equal(readFileSync(paths.configFile, 'utf8'), before);
});

test('guided configuration requires trust confirmation and can configure multiple sources', async t => {
  const options = fixture(t);
  const answers = ['guided', 'work', 'https://mcp.example.test/mcp', 'slack,jira', 'Work Slack', 'Owned actions', 'identity', 'search,thread', 'Work Jira', 'Assigned tickets', 'identity', 'issue', 'yes'];
  await runSetup({ ...options, args: ['--provider', 'claude'], ask: async () => answers.shift() });
  const built = JSON.parse(readFileSync(setupPaths(options).configFile, 'utf8'));
  assert.deepEqual(Object.keys(built.sources), ['slack', 'jira']); assert.equal(built.sources.jira.readTools[0], 'mcp__work__issue');
  const other = fixture(t), declined = ['guided', 'work', 'https://mcp.example.test/mcp', 'slack', 'Work Slack', 'Owned actions', 'identity', 'search', 'no'];
  await runSetup({ ...other, args: ['--provider', 'claude'], ask: async () => declined.shift() });
  assert.equal(existsSync(setupPaths(other).configFile), false);
});

test('setup flags reject ambiguous or relative paths before importing private config', () => {
  assert.throws(() => parseSetupArgs(['--provider', 'shell']), /supported/);
  assert.throws(() => parseSetupArgs(['--provider', 'claude', '--skip-ai']), /Choose/);
  assert.throws(() => parseSetupArgs(['--config', './private.json']), /absolute/);
  assert.throws(() => setupPaths({ cwd: '/tmp', env: { TODOS_DATA_DIR: './relative' } }), /absolute/);
  assert.throws(() => setupPaths({ cwd: '/tmp', env: { FORMA_CLAUDE_SYNC_CONFIG: './relative' } }), /absolute/);
});

test('doctor treats a missing CLI as advisory for manual use and an error for selected AI', async t => {
  const options = fixture(t), missing = async () => { throw new Error('ENOENT private-token=secret'); };
  await runSetup({ ...options, args: ['--skip-ai'] });
  const manual = await collectDiagnostics({ ...options, run: missing });
  assert.equal(manual.ready, true); assert.equal(manual.aiRequired, false); assert.equal(manual.checks.find(check => check.id === 'cli').status, 'warning');
  const ai = await collectDiagnostics({ ...options, provider: 'claude', run: missing });
  assert.equal(ai.ready, false); assert.match(ai.checks.find(check => check.id === 'cli').action, /Install/);
  assert.doesNotMatch(JSON.stringify(ai), /private-token|secret/);
});

test('doctor reports unsupported Node, missing Claude features and unsupported versions clearly', async t => {
  const options = fixture(t);
  const oldNode = await collectDiagnostics({ ...options, nodeVersion: '22.15.0', skipAi: true, run: cli });
  assert.equal(oldNode.ready, false); assert.match(oldNode.checks.find(check => check.id === 'node').message, /22.16.0/);
  const unsupportedNode = await collectDiagnostics({ ...options, nodeVersion: '23.7.0', skipAi: true, run: cli });
  assert.equal(unsupportedNode.ready, false);
  const minimumNode = await collectDiagnostics({ ...options, nodeVersion: '22.16.0', skipAi: true, run: cli });
  assert.equal(minimumNode.ready, true);
  const oldClaude = await collectDiagnostics({ ...options, provider: 'claude', run: async (_name, args) => ({ stdout: args[0] === '--version' ? '2.1.294' : '--tools' }) });
  assert.equal(oldClaude.ready, false); assert.match(oldClaude.checks.find(check => check.id === 'cli-features').action, /2.1.295/);
  const windows = await collectDiagnostics({ ...options, platform: 'win32', skipAi: true, run: cli });
  assert.match(windows.checks.find(check => check.id === 'platform').message, /Windows.*not been validated/);
});

test('doctor only uses bounded local commands and never returns auth or config values', async t => {
  const options = fixture(t), paths = setupPaths(options), privateConfig = config();
  privateConfig.mcpServers.work.headers = { Authorization: 'Bearer config-secret' };
  saveClaudeSyncConfig(privateConfig, paths.configFile);
  mkdirSync(join(options.cwd, '.next')); writeFileSync(join(options.cwd, '.next', 'BUILD_ID'), 'build');
  const calls = [];
  const result = await collectDiagnostics({ ...options, provider: 'claude', checkAuth: true, run: async (name, args) => { calls.push([name, args]); return cli(name, args); } });
  assert.equal(result.ready, true);
  assert.deepEqual(calls, [['claude', ['--version']], ['claude', ['--help']], ['claude', ['auth', 'status', '--json']]]);
  assert.doesNotMatch(JSON.stringify(result), /private@example|config-secret|"token"|mcp\.example/);
  assert.match(result.checks.find(check => check.id === 'source-config').message, /not checked/);
  const failedAuth = await collectDiagnostics({ ...options, provider: 'claude', checkAuth: true, run: async (name, args) => args[0] === 'auth' ? { stdout: '{"loggedIn":false,"token":"private"}' } : cli(name, args) });
  assert.equal(failedAuth.ready, false); assert.match(failedAuth.checks.find(check => check.id === 'auth').action, /claude auth login/);
});

test('doctor reports invalid private config without exposing parser content', async t => {
  const options = fixture(t), paths = setupPaths(options);
  mkdirSync(dirname(paths.configFile), { recursive: true }); writeFileSync(paths.configFile, '{"token":"config-secret",broken');
  const result = await collectDiagnostics({ ...options, provider: 'claude', run: cli });
  assert.equal(result.ready, false); assert.doesNotMatch(JSON.stringify(result), /config-secret/);
  assert.equal(result.checks.find(check => check.id === 'source-config').status, 'error');
});

test('noninteractive setup and JSON doctor commands work without a terminal or network', t => {
  const options = fixture(t);
  const setup = spawnSync(process.execPath, ['scripts/setup.mjs', '--noninteractive', '--skip-ai'], { cwd: process.cwd(), env: { ...process.env, ...options.env }, encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.stderr); assert.match(setup.stdout, /manual dashboard/);
  const doctor = spawnSync(process.execPath, ['scripts/doctor.mjs', '--skip-ai', '--json'], { cwd: process.cwd(), env: { ...process.env, ...options.env, PATH: '' }, encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stderr); assert.equal(JSON.parse(doctor.stdout).aiRequired, false);
  const required = spawnSync(process.execPath, ['scripts/doctor.mjs', '--provider', 'claude', '--json'], { cwd: process.cwd(), env: { ...process.env, ...options.env, PATH: '' }, encoding: 'utf8' });
  assert.equal(required.status, 1, required.stderr); assert.equal(JSON.parse(required.stdout).ready, false);
});
