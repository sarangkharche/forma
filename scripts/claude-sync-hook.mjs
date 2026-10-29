import { readFileSync, appendFileSync } from 'node:fs';
try {
  const policy = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 4_000_000) throw new Error('Hook input limit.'); }
  const event = JSON.parse(input);
  if (event.hook_event_name === 'SessionStart') {
    if (!Array.isArray(policy.allowedTools) || !policy.allowedTools.length) throw new Error('Missing policy.');
    appendFileSync(process.argv[3], JSON.stringify({ event: 'ready', at: new Date().toISOString() }) + '\n', { mode: 0o600 });
    process.stdout.write('{}');
    process.exit(0);
  }
  if (!Array.isArray(policy.allowedTools) || !policy.allowedTools.includes(event.tool_name)) throw new Error('Tool is not approved for source sync.');
  if (!['PreToolUse', 'PostToolUse'].includes(event.hook_event_name)) throw new Error('Unsupported hook event.');
  const response = event.tool_response;
  if (event.hook_event_name === 'PostToolUse' && response !== null && ['object','string'].includes(typeof response) && !response.isError && !response.is_error) appendFileSync(process.argv[3], JSON.stringify({ event: 'success', tool: event.tool_name, at: new Date().toISOString() }) + '\n', { mode: 0o600 });
  process.stdout.write('{}');
} catch {
  process.stderr.write('Forma blocked this tool because its source sync policy could not approve it.');
  process.exitCode = 2;
}
