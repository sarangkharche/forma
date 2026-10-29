import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'todos-test-'));
  const store = createStore(directory, { seed: false });
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, directory };
}
const detected = { sourceKey: 'jira:TASK-123', title: 'Review the change', notes: 'Read the current diff.', links: [{ label: 'Ticket', url: 'https://example.com/ticket/123' }] };

test('detected tasks are deduplicated and persisted across connections', t => {
  const { store, directory } = fixture(t);
  assert.equal(store.ingest({ tasks: [detected] }).added, 1);
  assert.deepEqual(store.ingest({ tasks: [detected] }), { added: 0, updated: 0, total: 1 });
  const other = createStore(directory, { seed: false });
  try { assert.equal(other.list()[0].title, detected.title); } finally { other.close(); }
});

test('background enrichment preserves human edits and completed status', t => {
  const { store } = fixture(t);
  store.ingest({ tasks: [detected] });
  const original = store.list()[0];
  const edited = store.update(original.id, { title: 'My next step', notes: 'My plan', status: 'done', dueDate: '2026-10-12', links: [] }, original.version);
  store.ingest({ tasks: [{ ...detected, title: 'Vendor title', notes: 'New source evidence', status: 'todo', dueDate: '2026-10-13', priority: 'high' }] });
  const current = store.get(edited.id);
  assert.equal(current.title, 'My next step');
  assert.equal(current.notes, 'My plan');
  assert.equal(current.sourceNotes, 'New source evidence');
  assert.equal(current.status, 'done');
  assert.equal(current.dueDate, '2026-10-12');
  assert.equal(current.completedAt, edited.completedAt);
  assert.deepEqual(current.links, []);
  assert.equal(current.sourceLinks.length, 1);
  assert.equal(current.priority, 'high');
});

test('archived tasks remain archived and can be restored', t => {
  const { store } = fixture(t);
  store.ingest({ tasks: [detected] });
  const original = store.list()[0];
  store.update(original.id, { status: 'archived' }, original.version);
  store.ingest({ tasks: [{ ...detected, status: 'in_progress' }] });
  const archived = store.get(original.id);
  assert.equal(archived.status, 'archived');
  assert.equal(store.update(archived.id, { status: 'todo' }, archived.version).status, 'todo');
});

test('a stale editor cannot overwrite a newer update', t => {
  const { store } = fixture(t);
  const task = store.create({ title: 'Original title' });
  store.update(task.id, { title: 'New title' }, task.version);
  assert.throws(() => store.update(task.id, { title: 'Stale title' }, task.version), error => error.status === 409);
  assert.equal(store.get(task.id).title, 'New title');
});

test('invalid batches are atomic and unsafe links are rejected', t => {
  const { store } = fixture(t);
  assert.throws(() => store.ingest({ tasks: [detected, { sourceKey: 'broken', title: '' }] }));
  assert.equal(store.list().length, 0);
  assert.throws(() => store.create({ title: 'Bad link', links: [{ label: 'Open', url: 'javascript:alert(1)' }] }));
  assert.throws(() => store.create({ title: 'Bad date', dueDate: '2026-02-30' }));
  assert.equal(store.list().length, 0);
});

test('a new sync check records the check even when no tasks change', t => {
  const { store } = fixture(t);
  store.configureSync({ automationId: 'test', schedule: 'every hour' });
  store.ingest({ tasks: [], message: 'No new tasks.' });
  const { sync } = store.snapshot();
  assert.ok(sync.lastCheckedAt);
  assert.equal(sync.lastChangedAt, null);
  assert.equal(sync.automationId, 'test');
  assert.equal(sync.message, 'No new tasks.');
});

test('Codex chat links persist and manually edited references survive ingestion', t => {
  const { store } = fixture(t);
  const source = 'codex://threads/01a11671-972f-7a11-9122-b37d3345c957';
  const chosen = 'codex://threads/01a11381-6297-7c50-ba96-2f6c928e3d2e';
  store.ingest({ tasks: [{ ...detected, chatUrl: source }] });
  const task = store.list()[0];
  assert.equal(task.chatUrl, source);
  store.update(task.id, { chatUrl: chosen }, task.version);
  store.ingest({ tasks: [{ ...detected, chatUrl: source }] });
  assert.equal(store.get(task.id).chatUrl, chosen);
  assert.throws(() => store.create({ title: 'Invalid reference', chatUrl: 'javascript:alert(1)' }));
  assert.throws(() => store.create({ title: 'Wrong Codex route', chatUrl: 'codex://settings' }));
});

test('retry after a lost create response returns the same task',t=>{
 const {store}=fixture(t),key='00000000-0000-4000-8000-000000000001';
 const first=store.create({title:'Save once'},key);const retry=store.create({title:'Save once'},key);
 assert.equal(retry.id,first.id);assert.equal(store.list().length,1);assert.equal(store.activity(first.id).length,1);
 assert.throws(()=>store.create({title:'Bad request'},'invalid'));assert.equal(store.list().length,1);
});

test('source updates record differences and acknowledge only the opened update', t => {
  const { store } = fixture(t);
  store.ingest({ tasks: [detected] });
  const original = store.list()[0];
  assert.equal(original.sourceUpdates, undefined);
  store.update(original.id, { notes: 'My own plan' }, original.version);
  store.ingest({ tasks: [{ ...detected, notes: 'New evidence' }] });
  const first = store.get(original.id);
  assert.equal(first.notes, 'My own plan');
  assert.deepEqual(first.sourceUpdates[0].changes, [{ field: 'sourceNotes', before: detected.notes, after: 'New evidence' }]);
  store.ingest({ tasks: [{ ...detected, notes: 'Newer evidence' }] });
  const second = store.get(original.id);
  store.readSourceUpdates(original.id, first.sourceUpdates[0].id);
  const read = store.get(original.id);
  assert.notEqual(read.sourceUpdatesReadId, second.sourceUpdates.at(-1).id);
  assert.equal(read.version, second.version);
  assert.equal(read.updatedAt, second.updatedAt);
  store.ingest({ tasks: [{ ...detected, notes: 'Newer evidence' }], sources: { slack: { status: 'unavailable', detail: 'No access', checkedAt: null } } });
  assert.equal(store.get(original.id).sourceUpdates.length, 2);
  store.readSourceUpdates(original.id, second.sourceUpdates.at(-1).id);
  assert.equal(store.get(original.id).sourceUpdatesReadId, second.sourceUpdates.at(-1).id);
});
