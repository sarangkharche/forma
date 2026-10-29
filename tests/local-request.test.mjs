import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalWrite } from '../lib/local-request.mjs';
test('writes work for the actual loopback origin despite Next internal URL normalization', () => {
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: '127.0.0.1:5184', origin: 'http://127.0.0.1:5184' } })), true);
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: 'localhost:5184', origin: 'http://localhost:5184' } })), true);
});
test('writes from other web origins are blocked', () => {
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: '127.0.0.1:5184', origin: 'https://example.com' } })), false);
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: 'example.com:5184', origin: 'http://example.com:5184' } })), false);
});
