import { claudeSyncConfigPath, readClaudeSyncConfig } from '../lib/providers/claude-sync.mjs';
import { saveClaudeSyncConfig } from '../lib/setup.mjs';
try {
  const input = process.argv[2];
  if (!input || process.argv.slice(3).some(value => value !== '--replace-config')) throw new Error('Usage: npm run configure:claude-sync -- /absolute/path/config.json [--replace-config]');
  const config = readClaudeSyncConfig(input);
  if (!config) throw new Error('The supplied Claude sync config does not exist.');
  const target = claudeSyncConfigPath();
  saveClaudeSyncConfig(config, target, { replace: process.argv.includes('--replace-config') });
  console.log('Claude source sync configuration saved. Select Claude Code and Sync in Forma.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
