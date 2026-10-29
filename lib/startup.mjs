import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const marker = '<!-- Forma managed startup v1 -->';
const labels = /^com\.forma\.(?:local|test\.[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

function absolutePath(value, name) {
  if (typeof value !== 'string' || !isAbsolute(value) || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`${name} must be an absolute path without control characters.`);
  return resolve(value);
}

export function startupPlan(options = {}) {
  if ((options.platform ?? process.platform) !== 'darwin') throw new Error('Forma login startup is available on macOS only. Start Forma with npm start on this platform.');
  const root = absolutePath(options.root ?? process.cwd(), 'Forma directory');
  const nodePath = absolutePath(options.nodePath ?? process.execPath, 'Node executable');
  const home = absolutePath(options.home ?? homedir(), 'Home directory');
  const label = options.label ?? 'com.forma.local';
  if (typeof label !== 'string' || label.length > 100 || !labels.test(label)) throw new Error('Use the label com.forma.local or com.forma.test.<lowercase-suffix>.');
  const uid = options.uid ?? process.getuid();
  if (!Number.isSafeInteger(uid) || uid < 0) throw new Error('A valid user ID is required for login startup.');
  const env = options.env ?? process.env;
  const environment = {};
  for (const key of ['TODOS_DATA_DIR', 'FORMA_CHAT_WORKSPACE', 'FORMA_CLAUDE_SYNC_CONFIG']) {
    if (env[key]) environment[key] = absolutePath(env[key], key);
  }
  const dataDir = absolutePath(options.dataDir ?? environment.TODOS_DATA_DIR ?? join(root, '.todos'), 'Data directory');
  if (options.dataDir !== undefined) environment.TODOS_DATA_DIR = dataDir;
  const inheritedPath = options.path ?? env.PATH ?? '';
  if (typeof inheritedPath !== 'string' || /[\x00-\x1f\x7f]/.test(inheritedPath)) throw new Error('PATH must be a string without control characters.');
  environment.PATH = [...new Set([
    ...inheritedPath.split(':').filter(Boolean), dirname(nodePath), join(home, '.local', 'bin'), join(home, '.cargo', 'bin'),
    '/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
  ])].join(':');
  const agentDirectory = join(home, 'Library', 'LaunchAgents');
  const plistPath = join(agentDirectory, `${label}.plist`);
  const programArguments = [nodePath, join(root, 'scripts', 'start.mjs')];
  const logPaths = { stdout: join(dataDir, 'runtime.log'), stderr: join(dataDir, 'runtime-error.log') };
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
${marker}
<plist version="1.0"><dict>
<key>Label</key><string>${escape(label)}</string>
<key>ProgramArguments</key><array>${programArguments.map(value => `<string>${escape(value)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${escape(root)}</string>
<key>EnvironmentVariables</key><dict>${Object.entries(environment).map(([key, value]) => `<key>${key}</key><string>${escape(value)}</string>`).join('')}</dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${escape(logPaths.stdout)}</string>
<key>StandardErrorPath</key><string>${escape(logPaths.stderr)}</string>
</dict></plist>`;
  return { root, nodePath, home, label, dataDir, agentDirectory, plistPath, programArguments, environment, logPaths, plist, buildIdPath: join(root, '.next', 'BUILD_ID'), domain: `gui/${uid}`, serviceTarget: `gui/${uid}/${label}` };
}

export function parseStartupArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run' && options.dryRun === undefined) options.dryRun = true;
    else if (args[i] === '--label' && options.label === undefined && args[i + 1] && !args[i + 1].startsWith('--')) options.label = args[++i];
    else throw new Error('Usage: [--dry-run] [--label com.forma.local|com.forma.test.<lowercase-suffix>]');
  }
  return options;
}

function ownedPlist(plan) {
  let stat;
  try { stat = lstatSync(plan.plistPath); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing to change an unowned startup file: ${plan.plistPath}`);
  const contents = readFileSync(plan.plistPath, 'utf8');
  // Only our exact generated identity may replace or remove a login service.
  const identity = [
    marker,
    `<key>Label</key><string>${escape(plan.label)}</string>`,
    `<key>ProgramArguments</key><array>${plan.programArguments.map(value => `<string>${escape(value)}</string>`).join('')}</array>`,
    `<key>WorkingDirectory</key><string>${escape(plan.root)}</string>`,
  ];
  if (!identity.every(value => contents.split(value).length === 2) || ['Label', 'ProgramArguments', 'WorkingDirectory'].some(key => contents.split(`<key>${key}</key>`).length !== 2)) {
    throw new Error(`Refusing to change a startup file that does not belong to this Forma installation: ${plan.plistPath}`);
  }
  return true;
}

function serviceLoaded(plan, execFile) {
  try { execFile('launchctl', ['print', plan.serviceTarget], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return true; }
  catch (error) {
    const message = String(error.stderr ?? '');
    if (error.status === 113 && message.includes(`Could not find service "${plan.label}" in domain for user gui:`)) return false;
    throw error;
  }
}

function serviceState(plan, execFile, owned) {
  const loaded = serviceLoaded(plan, execFile);
  if (loaded && !owned) throw new Error(`Refusing to change ${plan.label}: a loaded service exists without this installation's owned plist.`);
  return loaded;
}

export function installStartup(options = {}, { execFile = execFileSync } = {}) {
  const plan = startupPlan(options);
  if (!existsSync(plan.buildIdPath) || !lstatSync(plan.buildIdPath).isFile() || !readFileSync(plan.buildIdPath, 'utf8').trim()) throw new Error('Run npm run build successfully before installing login startup.');
  if (!existsSync(plan.nodePath) || !existsSync(plan.programArguments[1])) throw new Error('The Node executable and Forma scripts/start.mjs must exist before installing login startup.');
  const owned = ownedPlist(plan);
  if (options.dryRun) return { ...plan, dryRun: true, status: 'planned' };
  const loaded = serviceState(plan, execFile, owned);
  mkdirSync(plan.agentDirectory, { recursive: true });
  mkdirSync(plan.dataDir, { recursive: true, mode: 0o700 });
  if (loaded) execFile('launchctl', ['bootout', plan.serviceTarget], { stdio: 'inherit' });
  const temporary = `${plan.plistPath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, plan.plist, { mode: 0o600, flag: 'wx' });
    renameSync(temporary, plan.plistPath);
  } finally { rmSync(temporary, { force: true }); }
  execFile('launchctl', ['bootstrap', plan.domain, plan.plistPath], { stdio: 'inherit' });
  return { ...plan, dryRun: false, status: 'installed' };
}

export function uninstallStartup(options = {}, { execFile = execFileSync } = {}) {
  const plan = startupPlan(options);
  const owned = ownedPlist(plan);
  if (options.dryRun) return { ...plan, dryRun: true, status: owned ? 'planned' : 'absent' };
  const loaded = serviceState(plan, execFile, owned);
  if (loaded) execFile('launchctl', ['bootout', plan.serviceTarget], { stdio: 'inherit' });
  if (owned) {
    ownedPlist(plan);
    rmSync(plan.plistPath);
  }
  return { ...plan, dryRun: false, status: owned ? 'removed' : 'absent' };
}
