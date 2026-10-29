import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { claudeSyncConfigPath, readClaudeSyncConfig } from '../lib/providers/claude-sync.mjs';
try {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: npm run configure:claude-sync -- /absolute/path/config.json');
  const config = readClaudeSyncConfig(input);
  if (!config) throw new Error('The supplied Claude sync config does not exist.');
  const target = claudeSyncConfigPath();
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  chmodSync(target, 0o600);
  console.log('Claude source sync configuration saved. Select Claude Code and Sync in Forma.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
