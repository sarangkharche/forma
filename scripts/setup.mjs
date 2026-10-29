import { createInterface } from 'node:readline/promises';
import { parseSetupArgs, runSetup } from '../lib/setup.mjs';

let terminal;
try {
  const args = process.argv.slice(2);
  const options = parseSetupArgs(args);
  if (options.help) console.log('Usage: npm run setup [-- --provider codex|claude | --skip-ai] [--config /absolute/path.json] [--replace-config] [--noninteractive]\nInteractive setup prompts for trusted MCP read tools. Noninteractive --config imports a config you have reviewed and trust. Existing config needs explicit replacement. Setup never starts a server, signs in or tests a source connection.');
  else {
    if (process.stdin.isTTY && process.stdout.isTTY && !options.noninteractive) terminal = createInterface({ input: process.stdin, output: process.stdout });
    await runSetup({ args, ...(terminal ? { ask: question => terminal.question(question) } : {}) });
  }
} catch (error) {
  // Configuration contents and provider output can contain private values.
  console.error(error instanceof SyntaxError ? 'Setup could not read local state. Check the data store before continuing.' : error?.code ? 'Setup could not access local files. Check the data directory permissions.' : error.message);
  process.exitCode = 1;
} finally { terminal?.close(); }
