import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.mjs';
import { backupData, restoreData } from '../lib/backup.mjs';

test('online backup includes WAL commits and restores tasks, human edits, decisions and settings', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'forma-backup-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = createStore(join(dir, 'source'), { seed: false }); t.after(() => source.close());
  const task = source.create({ title: 'Original' }), edited = source.update(task.id, { title: 'Human title', status: 'done' }, task.version);
  source.addDecision(task.id, 'Verified decision'); source.configureCalendar('reader@example.com');
  source.saveControlState(state => ({ ...state, selectedProvider: 'claude' }));
  const file = join(dir, 'snapshot.sqlite'); await backupData(file, join(dir, 'source'));
  assert.equal(statSync(file).mode & 0o777, 0o600);
  source.update(task.id, { title: 'Later edit' }, edited.version);
  const restoredPath = join(dir, 'restored'); await restoreData(file, restoredPath);
  const restored = createStore(restoredPath, { seed: false }); t.after(() => restored.close());
  assert.equal(restored.get(task.id).title, 'Human title'); assert.equal(restored.get(task.id).status, 'done');
  assert.equal(restored.get(task.id).completedAt, edited.completedAt);
  assert.equal(restored.activity(task.id)[0].text, 'Verified decision');
  assert.equal(restored.controlState().selectedProvider, 'claude'); assert.equal(restored.calendarConfig().accountEmail, 'reader@example.com');
  assert.equal(source.get(task.id).title, 'Later edit'); assert.equal(statSync(restoredPath).mode & 0o777, 0o700);
});

test('backup and restore refuse overwrites, missing data and unrelated files', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'forma-backup-safe-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = createStore(join(dir, 'source'), { seed: false }); t.after(() => source.close());
  const file = join(dir, 'snapshot.sqlite'); await backupData(file, join(dir, 'source'));
  const before = readFileSync(file);
  await assert.rejects(backupData(file, join(dir, 'source')), /already exists/); assert.deepEqual(readFileSync(file), before);
  await assert.rejects(restoreData(file, join(dir, 'source')), /new directory/);
  await assert.rejects(backupData(join(dir, 'missing.sqlite'), join(dir, 'missing')), /no Forma database/);
  const invalid = join(dir, 'invalid.sqlite'), target = join(dir, 'invalid-restore'); writeFileSync(invalid, 'not SQLite');
  await assert.rejects(restoreData(invalid, target)); assert.equal(existsSync(target), false);
});
