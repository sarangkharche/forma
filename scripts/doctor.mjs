import { collectDiagnostics, parseSetupArgs } from '../lib/setup.mjs';

try {
  const options = parseSetupArgs(process.argv.slice(2), { doctor: true });
  if (options.help) console.log('Usage: npm run doctor [-- --provider codex|claude | --skip-ai] [--check-auth] [--json]\nChecks local files, versions and CLI help only. --check-auth also reads local CLI sign in status. No model requests or source connection checks are performed.');
  else {
    const report = await collectDiagnostics({ provider: options.provider, skipAi: options['skip-ai'], checkAuth: options['check-auth'] });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const check of report.checks) console.log(`${check.status.toUpperCase()}: ${check.message}${check.action ? ` ${check.action}` : ''}`);
      console.log(report.ready ? 'Local checks passed. Source connectivity and model access remain unverified.' : 'Resolve the errors above, then rerun doctor.');
    }
    if (!report.ready) process.exitCode = 1;
  }
} catch { console.error('Doctor could not complete. Check arguments with --help and verify local data permissions.'); process.exitCode = 1; }
