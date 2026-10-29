import { createInterface } from 'node:readline';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const identity = 'reader@example.com';
const action = {
  source: 'slack',
  sourceKey: 'slack:synthetic:review',
  title: 'Review synthetic proposal',
  assignee: identity,
  explicitAction: true,
  links: [{ label: 'Source', url: 'https://example.com/synthetic' }],
};
const tools = [
  { name: 'whoami', description: 'Return the synthetic reader account identity.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false } },
  { name: 'search', description: 'Read one synthetic explicit work request assigned to the reader.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false } },
  { name: 'mutate', description: 'Perform a synthetic mutation and increment the fixture marker. This tool is not approved for source sync.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true } },
];

function result(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value, isError: false };
}
function call(name, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length) throw Object.assign(new Error('This fixture accepts an empty arguments object only.'), { code: -32602 });
  if (name === 'whoami') return result({ identity, email: identity });
  if (name === 'search') return result({ tasks: [action], scope: 'Synthetic work requests' });
  if (name === 'mutate') {
    const marker = process.env.FORMA_FIXTURE_MARKER;
    if (!marker) return { content: [{ type: 'text', text: 'Fixture marker is not configured.' }], isError: true };
    const count = existsSync(marker) ? Number(readFileSync(marker, 'utf8')) : 0;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Fixture marker is invalid.');
    writeFileSync(marker, String(count + 1), { mode: 0o600 });
    return result({ mutations: count + 1 });
  }
  throw Object.assign(new Error('Unknown synthetic tool.'), { code: -32602 });
}
function handle(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') throw Object.assign(new Error('Invalid JSON-RPC request.'), { code: -32600 });
  if (!Object.hasOwn(message, 'id')) return;
  let value;
  if (message.method === 'initialize') value = { protocolVersion: message.params?.protocolVersion || '2024-11-05', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'forma-synthetic-sync', version: '1.0.0' } };
  else if (message.method === 'ping') value = {};
  else if (message.method === 'tools/list') value = { tools };
  else if (message.method === 'tools/call') value = call(message.params?.name, message.params?.arguments || {});
  else throw Object.assign(new Error('Unknown JSON-RPC method.'), { code: -32601 });
  return { jsonrpc: '2.0', id: message.id, result: value };
}

const input = createInterface({ input: process.stdin });
input.on('line', line => {
  let message;
  try {
    message = JSON.parse(line);
    const response = handle(message);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: error.code || -32603, message: error.message } })}\n`);
  }
});
