import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalRequest, isLocalWrite } from '../lib/local-request.mjs';
test('writes work for the actual loopback origin despite Next internal URL normalization', () => {
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: '127.0.0.1:5184', origin: 'http://127.0.0.1:5184' } })), true);
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: 'localhost:5184', origin: 'http://localhost:5184' } })), true);
});
test('writes from other web origins are blocked', () => {
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: '127.0.0.1:5184', origin: 'https://example.com' } })), false);
  assert.equal(isLocalWrite(new Request('http://localhost:5184/api/tasks', { headers: { host: 'example.com:5184', origin: 'http://example.com:5184' } })), false);
});
test('local CLI reads and writes do not require Origin', () => {
  for (const host of ['127.0.0.1:5184', 'localhost:5184']) {
    for (const method of ['GET', 'POST']) {
      assert.equal(isLocalRequest(new Request('http://localhost:5184/api/tasks', { method, headers: { host } })), true);
    }
  }
});
test('API requests require a trusted Host even without Origin', () => {
  for (const host of [null, 'untrusted.example:5184', 'localhost:5185', 'localhost:5184.untrusted.example']) {
    for (const method of ['GET', 'POST']) {
      const headers = host === null ? {} : { host };
      assert.equal(isLocalRequest(new Request('http://localhost:5184/api/tasks', { method, headers })), false);
    }
  }
});
test('every present Origin must exactly match the trusted Host', () => {
  for (const origin of ['', 'null', 'https://localhost:5184', 'http://127.0.0.1:5184', 'https://untrusted.example']) {
    assert.equal(isLocalRequest(new Request('http://localhost:5184/api/tasks', { headers: { host: 'localhost:5184', origin } })), false);
  }
  assert.equal(isLocalWrite, isLocalRequest);
});
