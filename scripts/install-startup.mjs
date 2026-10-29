import { installStartup, parseStartupArgs } from '../lib/startup.mjs';

try {
  const result = installStartup(parseStartupArgs(process.argv.slice(2)));
  if (result.dryRun) console.log(JSON.stringify(result, null, 2));
  else console.log(`Forma login service installed: ${result.plistPath}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
