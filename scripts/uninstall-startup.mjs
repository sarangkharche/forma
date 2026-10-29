import { parseStartupArgs, uninstallStartup } from '../lib/startup.mjs';

try {
  const result = uninstallStartup(parseStartupArgs(process.argv.slice(2)));
  if (result.dryRun) console.log(JSON.stringify(result, null, 2));
  else console.log(result.status === 'absent' ? 'Forma login service is already absent.' : `Forma login service removed: ${result.plistPath}. Task data was preserved.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
