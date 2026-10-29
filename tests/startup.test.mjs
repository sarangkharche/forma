import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installStartup, parseStartupArgs, startupPlan, uninstallStartup } from '../lib/startup.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-startup-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'Forma <&> "test"'), home = join(directory, 'home'), nodePath = join(directory, 'node bin', 'node');
  mkdirSync(join(root, '.next'), { recursive: true });
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(directory, 'node bin'));
  writeFileSync(join(root, '.next', 'BUILD_ID'), 'synthetic-production-build');
  writeFileSync(join(root, 'scripts', 'start.mjs'), '');
  writeFileSync(nodePath, '');
  const options = { root, home, nodePath, env: {}, platform: 'darwin', uid: 501, label: 'com.forma.test.unit' };
  return { directory, options, plan: startupPlan(options) };
}

function launchctl(plan, { loaded = false, failure } = {}) {
  const calls = [];
  return {
    calls,
    execFile(command, args) {
      assert.equal(command, 'launchctl');
      calls.push(args);
      if (failure === args[0]) throw new Error(`Unexpected ${failure} failure`);
      if (args[0] === 'print' && !loaded) throw Object.assign(new Error('Service absent'), { status: 113, stderr: `Bad request.\nCould not find service "${plan.label}" in domain for user gui: 501\n` });
      return '';
    },
  };
}

function savePlist(plan, contents = plan.plist) {
  mkdirSync(plan.agentDirectory, { recursive: true });
  writeFileSync(plan.plistPath, contents);
}

test('startup plan escapes XML paths and keeps the existing local server lifecycle', t => {
  const { options, plan } = fixture(t);
  assert.equal(plan.label, 'com.forma.test.unit');
  assert.deepEqual(plan.programArguments, [options.nodePath, join(options.root, 'scripts', 'start.mjs')]);
  assert.match(plan.plist, /Forma &lt;&amp;&gt; &quot;test&quot;/);
  assert.match(plan.plist, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(plan.plist, /<key>KeepAlive<\/key><true\/>/);
  assert.equal(startupPlan({ ...options, label: undefined }).label, 'com.forma.local');
});

test('startup preserves the current PATH and user CLI locations without copying credentials', t => {
  const { options } = fixture(t);
  const plan = startupPlan({ ...options, env: { PATH: '/custom/bin:/usr/bin', OPENAI_API_KEY: 'never-copy-api-key', ANTHROPIC_API_KEY: 'never-copy-other-key', AWS_SECRET_ACCESS_KEY: 'never-copy-aws', HOME: '/another-home', SOME_SETTING: 'unexpected' } });
  const path = plan.environment.PATH.split(':');
  assert.deepEqual(path.slice(0, 2), ['/custom/bin', '/usr/bin']);
  for (const directory of [join(options.home, '.local', 'bin'), join(options.home, '.cargo', 'bin'), dirname(options.nodePath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/sbin', '/sbin']) assert.ok(path.includes(directory), directory);
  assert.equal(path.filter(value => value === '/usr/bin').length, 1);
  assert.deepEqual(Object.keys(plan.environment), ['PATH']);
  assert.doesNotMatch(plan.plist, /never-copy|API_KEY|AWS_SECRET|SOME_SETTING|another-home/);
  assert.ok(startupPlan({ ...options, path: '/explicit/bin', env: { PATH: '/discarded/bin' } }).environment.PATH.startsWith('/explicit/bin:'));
});

test('startup keeps only absolute explicit data, workspace and sync config settings', t => {
  const { directory, options } = fixture(t);
  const dataDir = join(directory, 'task data'), workspace = join(directory, 'workspace'), config = join(directory, 'config & sync.json');
  const plan = startupPlan({ ...options, env: { TODOS_DATA_DIR: dataDir, FORMA_CHAT_WORKSPACE: workspace, FORMA_CLAUDE_SYNC_CONFIG: config } });
  assert.equal(plan.dataDir, dataDir);
  assert.equal(plan.environment.TODOS_DATA_DIR, dataDir);
  assert.equal(plan.environment.FORMA_CHAT_WORKSPACE, workspace);
  assert.equal(plan.environment.FORMA_CLAUDE_SYNC_CONFIG, config);
  assert.deepEqual(plan.logPaths, { stdout: join(dataDir, 'runtime.log'), stderr: join(dataDir, 'runtime-error.log') });
  for (const key of ['TODOS_DATA_DIR', 'FORMA_CHAT_WORKSPACE', 'FORMA_CLAUDE_SYNC_CONFIG']) assert.throws(() => startupPlan({ ...options, env: { [key]: 'relative/path' } }), /absolute path/);
  assert.equal(startupPlan({ ...options, dataDir }).environment.TODOS_DATA_DIR, dataDir);
});

test('startup rejects unsupported systems before trying to resolve a user ID', () => {
  assert.throws(() => startupPlan({ platform: 'win32', get uid() { throw new Error('User ID should not be read'); } }), /macOS only/);
});

test('startup rejects unsafe labels, relative paths and control characters', t => {
  const { options } = fixture(t);
  for (const label of ['com.other.service', 'com.forma.local.other', 'com.forma.test.', 'com.forma.test.Upper', 'com.forma.test../escape', '../com.forma.local', 'com.forma.test.hello/world']) assert.throws(() => startupPlan({ ...options, label }), /label/);
  for (const key of ['root', 'nodePath', 'home', 'dataDir']) assert.throws(() => startupPlan({ ...options, [key]: 'relative' }), /absolute path/);
  assert.throws(() => startupPlan({ ...options, root: '/tmp/new\nline' }), /control characters/);
  assert.throws(() => startupPlan({ ...options, path: '/bin\n' }), /PATH/);
  assert.throws(() => startupPlan({ ...options, uid: -1 }), /user ID/);
});

test('startup CLI options accept only dry run and a single explicit label', () => {
  assert.deepEqual(parseStartupArgs(['--dry-run', '--label', 'com.forma.test.check']), { dryRun: true, label: 'com.forma.test.check' });
  for (const args of [['--label'], ['--label', '--dry-run'], ['--dry-run', '--dry-run'], ['--root', '/tmp'], ['--label', 'one', '--label', 'two']]) assert.throws(() => parseStartupArgs(args), /Usage/);
});

test('install requires a completed production build before creating files or invoking launchctl', t => {
  const { options, plan } = fixture(t);
  rmSync(plan.buildIdPath);
  const control = launchctl(plan);
  assert.throws(() => installStartup(options, control), /npm run build/);
  assert.equal(existsSync(plan.agentDirectory), false);
  assert.deepEqual(control.calls, []);
});

test('install and uninstall dry runs make no files and call no launchctl commands', t => {
  const { options, plan } = fixture(t);
  const control = { execFile() { assert.fail('dry run must not invoke launchctl'); } };
  assert.equal(installStartup({ ...options, dryRun: true }, control).status, 'planned');
  assert.equal(uninstallStartup({ ...options, dryRun: true }, control).status, 'absent');
  assert.equal(existsSync(plan.agentDirectory), false);
  assert.equal(existsSync(plan.dataDir), false);
});

test('first install bootstraps only its exact label and stores logs under the chosen data directory', t => {
  const { directory, options } = fixture(t);
  const configured = { ...options, env: { TODOS_DATA_DIR: join(directory, 'selected data') } }, plan = startupPlan(configured), control = launchctl(plan);
  assert.equal(installStartup(configured, control).status, 'installed');
  assert.deepEqual(control.calls, [['print', plan.serviceTarget], ['bootstrap', plan.domain, plan.plistPath]]);
  assert.equal(readFileSync(plan.plistPath, 'utf8'), plan.plist);
  assert.equal(statSync(plan.plistPath).mode & 0o777, 0o600);
  assert.ok(existsSync(plan.dataDir));
  assert.equal(existsSync(join(options.root, '.todos')), false);
});

test('reinstall stops only the matching owned service before bootstrap', t => {
  const { options, plan } = fixture(t);
  savePlist(plan);
  const control = launchctl(plan, { loaded: true });
  installStartup(options, control);
  assert.deepEqual(control.calls, [['print', plan.serviceTarget], ['bootout', plan.serviceTarget], ['bootstrap', plan.domain, plan.plistPath]]);
});

test('uninstall stops and removes only its owned plist while preserving task data and other services', t => {
  const { options, plan } = fixture(t);
  savePlist(plan);
  const other = join(plan.agentDirectory, 'com.forma.test.other.plist');
  writeFileSync(other, 'other service');
  mkdirSync(plan.dataDir);
  const data = join(plan.dataDir, 'tasks.sqlite');
  writeFileSync(data, 'task data');
  const control = launchctl(plan, { loaded: true });
  assert.equal(uninstallStartup(options, control).status, 'removed');
  assert.deepEqual(control.calls, [['print', plan.serviceTarget], ['bootout', plan.serviceTarget]]);
  assert.equal(existsSync(plan.plistPath), false);
  assert.equal(readFileSync(data, 'utf8'), 'task data');
  assert.equal(readFileSync(other, 'utf8'), 'other service');
});

test('uninstall handles an absent service and an owned unloaded plist', t => {
  const { options, plan } = fixture(t);
  const control = launchctl(plan);
  assert.equal(uninstallStartup(options, control).status, 'absent');
  assert.deepEqual(control.calls, [['print', plan.serviceTarget]]);
  savePlist(plan);
  assert.equal(uninstallStartup(options, launchctl(plan)).status, 'removed');
});

test('startup preserves unowned files and rejects another installation or changed identity', t => {
  const { options, plan } = fixture(t);
  const unowned = [
    plan.plist.replace('<!-- Forma managed startup v1 -->', ''),
    plan.plist.replace('com.forma.test.unit</string>', 'com.forma.local</string>'),
    plan.plist.replace('<key>ProgramArguments</key>', '<key>ProgramArguments</key><array><string>/other/node</string></array><key>ProgramArguments</key>'),
    plan.plist.replace('scripts/start.mjs', 'scripts/other.mjs'),
    plan.plist.replace('<key>WorkingDirectory</key>', '<key>WorkingDirectory</key><string>/other/root</string><key>WorkingDirectory</key>'),
  ];
  for (const contents of unowned) {
    savePlist(plan, contents);
    const control = { execFile() { assert.fail('unowned file must be rejected before launchctl'); } };
    assert.throws(() => installStartup(options, control), /does not belong/);
    assert.throws(() => uninstallStartup(options, control), /does not belong/);
    assert.equal(readFileSync(plan.plistPath, 'utf8'), contents);
  }
});

test('startup refuses symlinked plist files and a loaded service without ownership', t => {
  const { directory, options, plan } = fixture(t);
  const target = join(directory, 'unrelated.plist');
  writeFileSync(target, plan.plist);
  mkdirSync(plan.agentDirectory, { recursive: true });
  symlinkSync(target, plan.plistPath);
  assert.throws(() => installStartup(options, launchctl(plan)), /unowned startup file/);
  assert.throws(() => uninstallStartup(options, launchctl(plan)), /unowned startup file/);
  rmSync(plan.plistPath);
  for (const action of [installStartup, uninstallStartup]) {
    const control = launchctl(plan, { loaded: true });
    assert.throws(() => action(options, control), /loaded service exists/);
    assert.deepEqual(control.calls, [['print', plan.serviceTarget]]);
  }
  assert.equal(readFileSync(target, 'utf8'), plan.plist);
});

test('startup surfaces unexpected launchctl failures without removing a plist', t => {
  const { options, plan } = fixture(t);
  savePlist(plan);
  for (const action of [installStartup, uninstallStartup]) {
    for (const failure of ['print', 'bootout']) {
      assert.throws(() => action(options, launchctl(plan, { loaded: true, failure })), new RegExp(`Unexpected ${failure} failure`));
      assert.equal(readFileSync(plan.plistPath, 'utf8'), plan.plist);
    }
    const denied = { execFile() { throw Object.assign(new Error('Permission denied'), { status: 113, stderr: 'Permission denied' }); } };
    assert.throws(() => action(options, denied), /Permission denied/);
  }
});

test('a failed bootstrap surfaces the error and leaves the owned plist available for recovery', t => {
  const { options, plan } = fixture(t);
  assert.throws(() => installStartup(options, launchctl(plan, { failure: 'bootstrap' })), /Unexpected bootstrap failure/);
  assert.equal(readFileSync(plan.plistPath, 'utf8'), plan.plist);
  assert.equal(installStartup(options, launchctl(plan)).status, 'installed');
});

test('startup CLI dry runs use a synthetic home without mutating login configuration', t => {
  const { options } = fixture(t);
  const script = fileURLToPath(new URL('../scripts/install-startup.mjs', import.meta.url));
  const removal = fileURLToPath(new URL('../scripts/uninstall-startup.mjs', import.meta.url));
  const env = { ...process.env, HOME: options.home, TODOS_DATA_DIR: join(options.home, 'tasks'), FORMA_CHAT_WORKSPACE: options.root, FORMA_CLAUDE_SYNC_CONFIG: join(options.home, 'sync.json'), ANTHROPIC_API_KEY: 'never-copy-secret' };
  for (const file of [script, removal]) {
    const result = spawnSync(process.execPath, [file, '--dry-run', '--label', 'com.forma.test.cli'], { cwd: options.root, env, encoding: 'utf8' });
    if (process.platform === 'darwin') {
      assert.equal(result.status, 0, result.stderr);
      const plan = JSON.parse(result.stdout);
      assert.equal(plan.plistPath, join(options.home, 'Library', 'LaunchAgents', 'com.forma.test.cli.plist'));
      assert.equal(plan.environment.TODOS_DATA_DIR, env.TODOS_DATA_DIR);
      assert.doesNotMatch(result.stdout, /never-copy-secret|ANTHROPIC_API_KEY/);
    } else {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /macOS only/);
    }
  }
  assert.equal(existsSync(join(options.home, 'Library')), false);
});
