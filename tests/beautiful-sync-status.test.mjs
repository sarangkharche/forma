import test from 'node:test';
import assert from 'node:assert/strict';
import { syncPresentation } from '../components/beautiful/sync-status.mjs';

test('sync cannot claim import completion before the completed command', () => {
  for (const status of ['queued', 'processing', 'submitted']) {
    assert.equal(syncPresentation(status).tone, 'active');
    assert.notEqual(syncPresentation(status).label, 'Sync completed');
  }
  assert.match(syncPresentation('submitted').detail, /imported/);
  assert.equal(syncPresentation('completed').tone, 'done');
});

test('new requests and errors take precedence over an old completed command', () => {
  assert.equal(syncPresentation('completed', true).tone, 'active');
  assert.equal(syncPresentation('completed', false, 'Could not connect').detail, 'Could not connect');
  assert.equal(syncPresentation('failed').tone, 'failed');
  assert.equal(syncPresentation().tone, 'idle');
  assert.equal(syncPresentation('unknown').tone, 'idle');
});

test('shared sync copy works for either AI provider', () => {
  for (const status of [undefined, 'queued', 'processing', 'submitted', 'completed', 'failed']) {
    const state = syncPresentation(status);
    assert.doesNotMatch(`${state.label} ${state.detail}`, /Codex|Claude/);
  }
  assert.doesNotMatch(syncPresentation(undefined, true).detail, /Codex|Claude/);
});
