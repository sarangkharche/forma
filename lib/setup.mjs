import { accessSync, constants, existsSync, statSync, mkdirSync, openSync, closeSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { providerInfo, setProvider } from './providers/index.mjs';
import { claudeSyncConfigPath, readClaudeSyncConfig, validateClaudeSyncConfig } from './providers/claude-sync.mjs';

const execute = promisify(execFile);
const sourceNames = ['granola', 'slack', 'jira', 'codex', 'documents', 'calendar'];
const claudeFlags = ['--safe-mode', '--restricted', '--setting-sources', '--strict-mcp-config', '--permission-prompts', '--tools'];
const atLeast = (version, minimum) => {
  const parts = String(version).replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number);
  if (!parts) return false;
  for (let i = 0; i < 3; i++) { if (parts[i] !== minimum[i]) return parts[i] > minimum[i]; }
  return true;
};
const supportsNode = version => (atLeast(version, [22, 16, 0]) && !atLeast(version, [23, 0, 0])) || atLeast(version, [24, 0, 0]);

export function setupPaths({ cwd = process.cwd(), env = process.env } = {}) {
  for (const key of ['TODOS_DATA_DIR', 'FORMA_CLAUDE_SYNC_CONFIG']) {
    if (env[key] && !isAbsolute(env[key])) throw new Error(`Use an absolute ${key} path.`);
  }
  const dataDirectory = env.TODOS_DATA_DIR || resolve(cwd, '.todos');
  const configFile = cwd === process.cwd() && env === process.env
    ? claudeSyncConfigPath() : env.FORMA_CLAUDE_SYNC_CONFIG || join(dataDirectory, 'claude-sync.json');
  return { dataDirectory, configFile };
}

export function parseSetupArgs(args, { doctor = false } = {}) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--provider' || (!doctor && arg === '--config')) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Supply a value for ${arg}.`);
      options[arg.slice(2)] = value;
    } else if (['--skip-ai', '--help', ...(doctor ? ['--json', '--check-auth'] : ['--noninteractive', '--replace-config'])].includes(arg)) {
      options[arg.slice(2)] = true;
    } else throw new Error(`Unknown option ${arg}. Use --help.`);
  }
  if (options.provider) providerInfo(options.provider);
  if (options.provider && options['skip-ai']) throw new Error('Choose --provider or --skip-ai.');
  if (options.config && !isAbsolute(options.config)) throw new Error('Use an absolute config import path.');
  if (options['replace-config'] && !options.config && options.noninteractive) throw new Error('--replace-config needs --config in noninteractive setup.');
  return options;
}

export function buildClaudeSyncConfig({ serverName, url, sources }) {
  let address;
  try { address = new URL(url); } catch { throw new Error('Enter a full HTTP or HTTPS MCP server URL.'); }
  if (!['http:', 'https:'].includes(address.protocol)) throw new Error('Enter a full HTTP or HTTPS MCP server URL.');
  const exact = tool => typeof tool === 'string' && tool.startsWith('mcp__') ? tool : `mcp__${serverName}__${tool}`;
  return validateClaudeSyncConfig({
    mcpServers: { [serverName]: { type: 'http', url: address.href } },
    sources: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, {
      expectedIdentity: source.expectedIdentity,
      scope: source.scope,
      identityTool: exact(source.identityTool),
      readTools: source.readTools.map(exact),
    }])),
  });
}

export function saveClaudeSyncConfig(config, file, { replace = false } = {}) {
  if (!isAbsolute(file)) throw new Error('Use an absolute Claude sync config path.');
  validateClaudeSyncConfig(config);
  const text = JSON.stringify(config, null, 2) + '\n';
  if (Buffer.byteLength(text) > 65536) throw new Error('Claude sync config must be smaller than 64 KiB.');
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  if (!replace) {
    let descriptor;
    try { descriptor = openSync(file, 'wx', 0o600); writeFileSync(descriptor, text); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('Claude sync config already exists. Keep it or use --replace-config to replace it explicitly.');
      if (descriptor !== undefined) rmSync(file, { force: true });
      throw new Error('Could not save Claude sync config. Check directory permissions.');
    } finally { if (descriptor !== undefined) closeSync(descriptor); }
    return;
  }
  const temporary = join(dirname(file), `.claude-sync-${randomUUID()}.tmp`);
  try { writeFileSync(temporary, text, { flag: 'wx', mode: 0o600 }); renameSync(temporary, file); }
  catch { throw new Error('Could not replace Claude sync config. Check directory permissions.'); }
  finally { rmSync(temporary, { force: true }); }
}

async function guidedConfig(ask, log) {
  log('Use tool names from your real MCP server. Forma cannot discover or verify them during setup. A blank answer skips source configuration.');
  const serverName = (await ask('MCP server name: ')).trim();
  if (!serverName) return null;
  const url = (await ask('HTTP or HTTPS MCP server URL: ')).trim();
  if (!url) return null;
  const names = (await ask(`Sources (${sourceNames.join(', ')}), separated by commas: `)).split(',').map(value => value.trim()).filter(Boolean);
  if (!names.length) return null;
  if (names.some(name => !sourceNames.includes(name)) || new Set(names).size !== names.length) throw new Error('Choose each supported source at most once.');
  const sources = {};
  for (const name of names) {
    const expectedIdentity = (await ask(`${name}: expected account and workspace identity: `)).trim();
    if (!expectedIdentity) return null;
    const scope = (await ask(`${name}: allowed search scope: `)).trim();
    if (!scope) return null;
    const identityTool = (await ask(`${name}: exact identity tool name: `)).trim();
    if (!identityTool) return null;
    const readTools = (await ask(`${name}: exact read tool names, separated by commas: `)).split(',').map(value => value.trim()).filter(Boolean);
    if (!readTools.length) return null;
    sources[name] = { expectedIdentity, scope, identityTool, readTools };
  }
  const config = buildClaudeSyncConfig({ serverName, url, sources });
  if ((await ask('Have you verified this trusted server and that all listed tools only read data? Type yes to save: ')).trim().toLowerCase() !== 'yes') return null;
  return config;
}

export async function runSetup({ args = [], cwd = process.cwd(), env = process.env, ask, log = console.log } = {}) {
  const options = parseSetupArgs(args);
  const interactive = Boolean(ask) && !options.noninteractive;
  if (!interactive && !options.provider && !options['skip-ai']) throw new Error('For noninteractive setup use --provider codex, --provider claude or --skip-ai.');
  if (!interactive && options['replace-config'] && !options.config) throw new Error('--replace-config needs --config in noninteractive setup.');
  if (!supportsNode(process.versions.node)) throw new Error('Use Node 22.16.0 or newer in the 22 series, or Node 24 or newer. Update Node, then rerun setup.');
  const { dataDirectory, configFile } = setupPaths({ cwd, env });
  const { createStore } = await import('./store.mjs');
  const store = createStore(dataDirectory, { seed: false });
  try {
    const state = store.controlState();
    let provider = options['skip-ai'] ? null : options.provider;
    if (interactive && provider === undefined) {
      const previous = state.setup?.aiEnabled === false ? null : state.selectedProvider;
      const answer = (await ask(`AI provider: codex, claude or skip [${previous || 'skip'}]: `)).trim().toLowerCase();
      provider = answer ? (answer === 'skip' ? null : providerInfo(answer).id) : previous || null;
    }
    if (options.config && provider !== 'claude') throw new Error('Select --provider claude when importing Claude source configuration.');
    let config;
    if (options.config) {
      config = readClaudeSyncConfig(options.config);
      if (!config) throw new Error('The supplied Claude sync config does not exist.');
      if (interactive && (await ask('Have you reviewed this trusted config and verified its tools only read data? Type yes to save: ')).trim().toLowerCase() !== 'yes') config = null;
    } else if (interactive && provider === 'claude') {
      const answer = (await ask('Optional source sync: type guided, enter an absolute config import path or press Enter to keep existing config: ')).trim();
      if (answer === 'guided') config = await guidedConfig(ask, log);
      else if (answer) {
        config = readClaudeSyncConfig(answer);
        if (!config) throw new Error('The supplied Claude sync config does not exist.');
        if ((await ask('Have you reviewed this trusted config and verified its tools only read data? Type yes to save: ')).trim().toLowerCase() !== 'yes') config = null;
      }
    }
    if (config) {
      let replace = Boolean(options['replace-config']);
      if (existsSync(configFile) && !replace && interactive) replace = (await ask('Existing source config is present. Type replace to overwrite it or press Enter to keep it: ')).trim() === 'replace';
      if (!existsSync(configFile) || replace || !interactive) {
        saveClaudeSyncConfig(config, configFile, { replace });
        log('Claude source configuration saved. No source connection or identity check was performed.');
      } else log('Existing Claude source configuration kept. No source connection or identity check was performed.');
    }
    if (provider) setProvider(store, provider);
    store.saveControlState(current => ({ ...current, setup: { ...current.setup, aiEnabled: Boolean(provider) } }));
    log(provider ? `${providerInfo(provider).label} selected. Sign in separately with: ${provider === 'claude' ? 'claude auth login' : 'codex login'}` : 'AI setup skipped. The manual dashboard is available. Existing provider selection is preserved.');
    if (provider === 'claude') log('Check the real source CLI and MCP server documentation for authentication and exact read tool names. No server or login was launched.');
    log(`Next: npm run doctor${provider ? ' -- --check-auth' : ' -- --skip-ai'}, then npm run build and npm start.`);
    return { provider, aiEnabled: Boolean(provider), configFile };
  } finally { store.close(); }
}

async function readSetupState(dataDirectory) {
  const file = join(dataDirectory, 'tasks.sqlite');
  if (!existsSync(file)) return {};
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  try { const row = db.prepare('SELECT data FROM meta WHERE key=?').get('control'); return row ? JSON.parse(row.data) : {}; }
  finally { db.close(); }
}

export async function collectDiagnostics({ cwd = process.cwd(), env = process.env, run, platform = process.platform, nodeVersion = process.versions.node, provider, skipAi = false, checkAuth = false } = {}) {
  const checks = [];
  const add = (id, status, message, action) => checks.push({ id, status, message, ...(action ? { action } : {}) });
  const supportedNode = supportsNode(nodeVersion);
  add('node', supportedNode ? 'ok' : 'error', supportedNode ? `Node ${nodeVersion} meets the minimum.` : 'Use Node 22.16.0 or newer in the 22 series, or Node 24 or newer.', supportedNode ? undefined : 'Install a supported Node version, then rerun npm install.');
  add('platform', ['darwin', 'linux'].includes(platform) ? 'ok' : 'warning', ['darwin', 'linux'].includes(platform) ? 'Local macOS or Linux platform supported.' : 'This platform is unverified. Windows startup and process handling have not been validated.');
  let paths, state = {};
  try { paths = setupPaths({ cwd, env }); }
  catch { add('data', 'error', 'Data or Claude config path is invalid.', 'Set TODOS_DATA_DIR and FORMA_CLAUDE_SYNC_CONFIG to absolute paths.'); }
  if (paths) {
    try {
      let target = paths.dataDirectory;
      while (!existsSync(target) && dirname(target) !== target) target = dirname(target);
      if (!statSync(target).isDirectory()) throw new Error();
      accessSync(target, constants.R_OK | constants.W_OK | constants.X_OK);
      if (existsSync(join(paths.dataDirectory, 'tasks.sqlite'))) accessSync(join(paths.dataDirectory, 'tasks.sqlite'), constants.R_OK | constants.W_OK);
      add('data', 'ok', existsSync(paths.dataDirectory) ? 'Data directory is readable and writable.' : 'Data directory can be created by setup.');
      if (supportedNode) state = await readSetupState(paths.dataDirectory);
    } catch { add('data', 'error', 'Could not read the local data store or write its directory.', 'Check data directory permissions and close any incompatible database writer.'); }
  }
  add('build', existsSync(join(cwd, '.next', 'BUILD_ID')) ? 'ok' : 'warning', existsSync(join(cwd, '.next', 'BUILD_ID')) ? 'Production build is present.' : 'Production build is not present. This is expected during development.', existsSync(join(cwd, '.next', 'BUILD_ID')) ? undefined : 'Run npm run build before npm start.');
  const aiRequired = !skipAi && (Boolean(provider) || state.setup?.aiEnabled === true || (state.setup?.aiEnabled !== false && Boolean(state.selectedProvider)));
  const selected = providerInfo(provider || state.selectedProvider || 'codex').id;
  const issue = aiRequired ? 'error' : 'warning';
  const command = run || ((name, args) => execute(name, args, { cwd, env, timeout: 10000, maxBuffer: 262144 }));
  const safeRun = async args => { try { const result = await command(selected, args); return { ok: result?.code === undefined || result.code === 0, stdout: String(result?.stdout || '') }; } catch { return { ok: false, stdout: '' }; } };
  const version = await safeRun(['--version']);
  const number = version.stdout.match(/\b(\d+\.\d+\.\d+)\b/)?.[1];
  if (!version.ok || !number) add('cli', issue, `${providerInfo(selected).label} CLI is unavailable or did not report a version.`, `Install the ${selected} CLI and make it available on PATH. The manual dashboard can still be used.`);
  else {
    add('cli', 'ok', `${providerInfo(selected).label} CLI ${number} is available.`);
    const help = await safeRun(['--help']);
    if (selected === 'claude') {
      const supported = atLeast(number, [2, 1, 295]) && help.ok && claudeFlags.every(flag => help.stdout.includes(flag));
      add('cli-features', supported ? 'ok' : issue, supported ? 'Required Claude CLI safety options are present.' : 'Required Claude CLI version or safety options are missing.', supported ? undefined : 'Update Claude Code to 2.1.295 or newer with all required options.');
      if (paths) {
        try {
          const config = readClaudeSyncConfig(paths.configFile);
          add('source-config', config ? 'ok' : 'warning', config ? 'Claude source configuration is valid. Connections and identities were not checked.' : 'Claude source sync has not been configured.', config ? undefined : 'Run npm run setup to configure trusted MCP read tools.');
        } catch { add('source-config', issue, 'Claude source configuration could not be loaded.', 'Run npm run setup to review or replace the config.'); }
      }
    } else {
      const execHelp = await safeRun(['exec', '--help']);
      const serverHelp = await safeRun(['app-server', '--help']);
      const supported = help.ok && help.stdout.includes('app-server') && serverHelp.ok && serverHelp.stdout.includes('--stdio') && execHelp.ok && ['--json', '--sandbox', '--skip-git-repo-check'].every(flag => execHelp.stdout.includes(flag));
      add('cli-features', supported ? 'ok' : issue, supported ? 'Required Codex CLI commands and options are present.' : 'Required Codex CLI commands or options are missing.', supported ? undefined : 'Update Codex CLI to a version with app-server and the required exec options.');
    }
    if (checkAuth) {
      const auth = await safeRun(selected === 'claude' ? ['auth', 'status', '--json'] : ['login', 'status']);
      let authenticated = auth.ok;
      if (selected === 'claude') { try { authenticated = auth.ok && JSON.parse(auth.stdout).loggedIn === true; } catch { authenticated = false; } }
      add('auth', authenticated ? 'ok' : issue, authenticated ? 'Local CLI reports signed in. No model or source request was made.' : 'Local CLI sign in was not confirmed.', authenticated ? undefined : `Run ${selected === 'claude' ? 'claude auth login' : 'codex login'} yourself, then rerun doctor --check-auth.`);
    } else add('auth', 'warning', 'CLI sign in was not checked.', 'Use npm run doctor -- --check-auth for the local CLI status check.');
  }
  return { ready: !checks.some(check => check.status === 'error'), provider: selected, aiRequired, checks };
}
