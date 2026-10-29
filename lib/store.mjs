import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const fields = ['title', 'notes', 'category', 'status', 'priority', 'dueDate', 'links', 'chatUrl', 'objective', 'constraints', 'completionCriteria', 'nextStep', 'workspacePath', 'responsibility', 'relatedChats', 'artifacts'];
const statuses = ['todo', 'in_progress', 'waiting', 'done', 'archived'];
const priorities = ['high', 'normal', 'low'];
export class StoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function validate(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StoreError('Enter a task object.');
  const out = {};
  for (const key of fields) {
    if (!(key in input)) continue;
    const val = input[key];
    if (['objective','constraints','completionCriteria','nextStep','workspacePath'].includes(key)) {
      if (typeof val !== 'string' || val.length > 12000 || (key === 'workspacePath' && val && !val.startsWith('/'))) throw new StoreError(`Check ${key}.`);
      out[key] = val.trim();
    } else if (key === 'responsibility') {
      if (!['your_turn','agent','waiting','review'].includes(val)) throw new StoreError('Choose who needs to act.'); out[key] = val;
    } else if (key === 'relatedChats' || key === 'artifacts') {
      if (!Array.isArray(val) || val.length > 30 || val.some(v => typeof v !== 'string' || v.length > 4000 || (key === 'relatedChats' ? !/^codex:\/\/threads\/[0-9a-f-]{36}$/i.test(v) : !v.startsWith('/')))) throw new StoreError(`Check ${key}.`);
      out[key] = [...new Set(val)];
    } else if (['title', 'notes', 'category'].includes(key)) {
      if (typeof val !== 'string' || val.length > (key === 'notes' ? 12000 : 500)) throw new StoreError(`Check ${key}.`);
      out[key] = key === 'notes' ? val : val.trim();
    } else if (key === 'status') {
      if (!statuses.includes(val)) throw new StoreError('Choose a valid status.'); out[key] = val;
    } else if (key === 'priority') {
      if (!priorities.includes(val)) throw new StoreError('Choose a valid priority.'); out[key] = val;
    } else if (key === 'dueDate') {
      if (val !== null && (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val) || new Date(val).toISOString().slice(0, 10) !== val)) throw new StoreError('Choose a valid due date.');
      out[key] = val;
    } else if (key === 'chatUrl') {
      if (val !== null && (typeof val !== 'string' || !/^codex:\/\/threads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))) throw new StoreError('Use a Codex chat link such as codex://threads/ followed by the chat ID.');
      out[key] = val;
    } else if (key === 'links') {
      if (!Array.isArray(val) || val.length > 30) throw new StoreError('Use up to 30 links.');
      out.links = val.map(link => {
        if (typeof link?.label !== 'string' || link.label.length > 100 || typeof link?.url !== 'string' || link.url.length > 4000) throw new StoreError('Check the link name and address.');
        let url; try { url = new URL(link.url); } catch { throw new StoreError('Enter a full link address.'); }
        if (!['https:', 'http:'].includes(url.protocol)) throw new StoreError('Links must use http or https.');
        return { label: link.label.trim() || url.hostname, url: url.href };
      });
    }
  }
  if ((!partial || 'title' in out) && !out.title) throw new StoreError('Give the task a title.');
  return out;
}
export function createStore(directory = process.env.TODOS_DATA_DIR || join(process.cwd(), '.todos'), { seed = true } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const db = new DatabaseSync(join(directory, 'tasks.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, source_key TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, data TEXT NOT NULL);`);
  const get = id => {
    const row = db.prepare('SELECT data FROM tasks WHERE id=?').get(id);
    if (!row) throw new StoreError('This task no longer exists. Refresh the list.', 404);
    return JSON.parse(row.data);
  };
  const save = task => db.prepare('INSERT INTO tasks VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(task.id, task.sourceKey, JSON.stringify(task));
  const meta = key => { const row = db.prepare('SELECT data FROM meta WHERE key=?').get(key); return row ? JSON.parse(row.data) : null; };
  const setMeta = (key, val) => db.prepare('INSERT INTO meta VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(key, JSON.stringify(val));
  const transaction = work => { db.exec('BEGIN IMMEDIATE'); try { const result = work(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const recordActivity = (taskId, type, text, origin = 'You', now = new Date()) => { const value = { id: randomUUID(), taskId, type, text, origin, createdAt: now.toISOString() }; if(origin === 'You' && ['worked','edited'].includes(type))setMeta('progress',{...(meta('progress') || {}),[taskId]:value.createdAt}); db.prepare('INSERT INTO activity VALUES (?, ?, ?)').run(value.id, taskId, JSON.stringify(value)); return value; };
  const activity = taskId => db.prepare('SELECT data FROM activity WHERE task_id=? ORDER BY rowid DESC LIMIT 100').all(taskId).map(row => JSON.parse(row.data));
  const sync = () => meta('sync') || { lastCheckedAt: null, lastChangedAt: null, automationId: null, schedule: null, message: 'Initial tasks added from your work list.' };
  const list = () => db.prepare('SELECT data FROM tasks ORDER BY rowid').all().map(row => JSON.parse(row.data));
  function make(input, origin, sourceKey) {
    const now = new Date().toISOString();
    const task = { id: randomUUID(), sourceKey, title: '', notes: '', category: 'Work', status: 'todo', priority: 'normal', dueDate: null, links: [], chatUrl: null, objective: '', constraints: '', completionCriteria: '', nextStep: '', workspacePath: '', responsibility: 'your_turn', relatedChats: [], artifacts: [], ...validate(input), origin, createdAt: now, updatedAt: now, completedAt: input.status === 'done' ? now : null, version: 1, manualFields: origin === 'You' ? fields : [] };
    if (origin === 'Codex') { task.sourceNotes = task.notes; task.sourceLinks = task.links; }
    return task;
  }
  function create(input, requestId = null) {
    if (requestId !== null && (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))) throw new StoreError('Invalid save request.');
    return transaction(() => {
      const sourceKey = `manual:${requestId || randomUUID()}`;
      const existing = db.prepare('SELECT data FROM tasks WHERE source_key=?').get(sourceKey);
      if (existing) return JSON.parse(existing.data);
      const task = make(input, 'You', sourceKey); save(task); recordActivity(task.id, 'created', 'Task added.'); return task; });
  }
  function update(id, input, version) {
    return transaction(() => {
      const task = get(id);
      if (!Number.isInteger(version) || version !== task.version) throw new StoreError('This task changed while you were editing. Close it and open it again to get the latest version.', 409);
      const changes = validate(input, true);
      const changedKeys = Object.keys(changes).filter(key => JSON.stringify(changes[key]) !== JSON.stringify(task[key]));
      if (!changedKeys.length) return task;
      const next = { ...task, ...changes, manualFields: [...new Set([...task.manualFields, ...changedKeys])], version: task.version + 1, updatedAt: new Date().toISOString() };
      if (next.status === 'done' && task.status !== 'done') next.completedAt = next.updatedAt;
      if (next.status !== 'done') next.completedAt = null;
      save(next); recordActivity(id, 'edited', `Updated ${changedKeys.join(', ')}.`); return next;
    });
  }
  function ingest(batch) {
    if (!batch || !Array.isArray(batch.tasks) || batch.tasks.length > 100) throw new StoreError('Supply a tasks array with up to 100 tasks.');
    // Validate the whole batch before starting. A bad task must not partly apply a check.
    if (batch.sources) { for (const [name, value] of Object.entries(batch.sources)) { if (!['granola','slack','jira','codex','documents','calendar'].includes(name) || !value || !['checked','limited','unavailable'].includes(value.status) || typeof value.detail !== 'string' || value.detail.length > 1000 || (value.checkedAt !== null && !Number.isFinite(Date.parse(value.checkedAt)))) throw new StoreError('Check source coverage.'); } }
    let meetings;
    if (batch.meetings !== undefined) {
      if (!Array.isArray(batch.meetings) || batch.meetings.length > 200) throw new StoreError('Check meeting records.');
      meetings = batch.meetings.map(value => {
        if (!value || typeof value.sourceKey !== 'string' || !value.sourceKey || typeof value.title !== 'string' || !value.title || value.title.length > 500 || typeof value.source !== 'string' || !value.source || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value.startAt || '') || !Number.isFinite(Date.parse(value.startAt)) || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value.endAt || '') || (value.cancelled!==undefined&&typeof value.cancelled!=='boolean') || !Number.isFinite(Date.parse(value.endAt)) || Date.parse(value.endAt) <= Date.parse(value.startAt)) throw new StoreError('Meeting times need verified timestamps and a source.');
        let link; try { link = new URL(value.url); } catch { throw new StoreError('Check meeting source link.'); }
        if (!['https:','http:'].includes(link.protocol)) throw new StoreError('Check meeting source link.');
        if (!meta('calendar')?.accountEmail || value.accountEmail !== meta('calendar').accountEmail) throw new StoreError('Meetings must come from the configured work calendar account.');
        return { accountEmail:value.accountEmail, sourceKey:value.sourceKey, title:value.title, source:value.source, startAt:value.startAt, endAt:value.endAt, url:link.href, cancelled:Boolean(value.cancelled), checkedAt:value.checkedAt || new Date().toISOString() };
      });
    }
    if (batch.meetingWindow && (!Number.isFinite(Date.parse(batch.meetingWindow.start)) || !Number.isFinite(Date.parse(batch.meetingWindow.end)) || Date.parse(batch.meetingWindow.end) <= Date.parse(batch.meetingWindow.start) || typeof batch.meetingWindow.source !== 'string' || !meetings)) throw new StoreError('Check meeting coverage window.');
    const incoming = batch.tasks.map(input => {
      if (typeof input.sourceKey !== 'string' || !input.sourceKey.trim() || input.sourceKey.length > 500) throw new StoreError('Every detected task needs a stable sourceKey.');
      return { ...validate(input), sourceKey: input.sourceKey.trim() };
    });
    return transaction(() => {
      let added = 0, updated = 0;
      for (const input of incoming) {
        const row = db.prepare('SELECT data FROM tasks WHERE source_key=?').get(input.sourceKey);
        if (!row) { const task = make(input, 'Codex', input.sourceKey); save(task); recordActivity(task.id, 'created', 'Task detected from source evidence.', 'Codex'); added++; continue; }
        const task = JSON.parse(row.data), next = { ...task };
        for (const key of fields) {
          // Codex enriches evidence. Only you can change the lifecycle of an existing task.
          if (key !== 'status' && key in input && !task.manualFields.includes(key)) next[key] = input[key];
        }
        next.sourceNotes = input.notes ?? task.sourceNotes ?? task.notes;
        next.sourceLinks = input.links ?? task.sourceLinks ?? task.links;
        if (JSON.stringify(next) !== JSON.stringify(task)) {
          next.updatedAt = new Date().toISOString();
          const changedFields = [...fields.filter(key => key !== 'status'), 'sourceNotes', 'sourceLinks'].filter(key => JSON.stringify(task[key]) !== JSON.stringify(next[key]));
          const changes = changedFields.filter(key => !(['sourceNotes', 'sourceLinks'].includes(key) && changedFields.includes(key === 'sourceNotes' ? 'notes' : 'links'))).map(field => ({ field, before: task[field] ?? null, after: next[field] ?? null }));
          next.sourceUpdates = [...(task.sourceUpdates || []), { id: randomUUID(), createdAt: next.updatedAt, changes }].slice(-20);
          next.version++; save(next); recordActivity(task.id, 'source_update', 'Source evidence refreshed. Your edits were preserved.', 'Codex'); updated++;
        }
      }
      if (meetings) {
        let previous = meta('meetings') || [];
        if (batch.meetingWindow) previous = previous.filter(item => item.source !== batch.meetingWindow.source || Date.parse(item.startAt) < Date.parse(batch.meetingWindow.start) || Date.parse(item.startAt) >= Date.parse(batch.meetingWindow.end));
        const combined = new Map(previous.map(item => [item.sourceKey,item]));
        for (const meeting of meetings) combined.set(meeting.sourceKey,meeting);
        setMeta('meetings',[...combined.values()]);
      }
      if (batch.sources) {
        const coverage = meta('sources') || {};
        for (const [name, value] of Object.entries(batch.sources)) {
          const previous = coverage[name] || {};
          coverage[name] = { ...value,
            lastAttemptAt: value.checkedAt || new Date().toISOString(),
            lastSuccessfulAt: value.status === 'checked' && value.checkedAt ? value.checkedAt : previous.lastSuccessfulAt || (previous.status === 'checked' ? previous.checkedAt : null),
            lastCheckedAt: value.checkedAt || previous.lastCheckedAt || previous.checkedAt || null,
          };
        }
        setMeta('sources', coverage);
      }
      const now = new Date().toISOString(), previous = sync();
      setMeta('sync', { ...previous, lastCheckedAt: now, lastChangedAt: added || updated ? now : previous.lastChangedAt, message: typeof batch.message === 'string' ? batch.message.slice(0, 500) : `Added ${added} tasks. Updated ${updated} tasks.` });
      return { added, updated, total: list().length };
    });
  }
  if (seed && !meta('seeded')) {
    const seeds = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
    ingest({ tasks: seeds, message: 'Your work list is ready.' });
    setMeta('seeded', true);
  }
  return { readSourceUpdates: (id, updateId) => transaction(() => { const task = get(id); if (!(task.sourceUpdates || []).some(item => item.id === updateId)) throw new StoreError('This update no longer exists.', 409); save({ ...task, sourceUpdatesReadId: updateId }); return get(id); }), configureCalendar: accountEmail => { if(typeof accountEmail !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(accountEmail)) throw new StoreError('Check the work calendar email.'); setMeta('calendar',{accountEmail}); }, calendarConfig: () => meta('calendar'), meetings: () => (meta('meetings') || []).filter(meeting=>meeting.accountEmail===meta('calendar')?.accountEmail), inboxState: () => meta('inbox'), saveInboxState: work => transaction(() => { const next = work(meta('inbox')); setMeta('inbox',next); return next; }), lastProgress: id => meta('progress')?.[id] || activity(id).find(item=>item.origin==='You'&&['worked','edited'].includes(item.type))?.createdAt || null, recordProgress: (id,now = new Date()) => { get(id); return recordActivity(id,'worked','Progress recorded. Reminders will use this time.','You',now); }, activity, addDecision: (id, text) => { get(id); if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new StoreError('Write a decision of up to 4000 characters.'); return recordActivity(id, 'decision', text.trim()); }, controlState: () => meta('control') || { agents: [], commands: [], reviewed: {}, workerAt: null, backup: null }, saveControlState: work => transaction(() => { const next = work(meta('control') || { agents: [], commands: [], reviewed: {}, workerAt: null, backup: null }); setMeta('control', next); return next; }), backupTo: file => backup(db, file), notificationState: () => meta('notifications'), saveNotificationState: work => transaction(() => { const next = work(meta('notifications')); setMeta('notifications', next); return next; }), list, get, create, update, ingest, snapshot: () => ({ tasks: list(), sync: sync(), sources: meta('sources') || {} }), configureSync: values => setMeta('sync', { ...sync(), ...values }), close: () => db.close() };
}
let singleton;
export const getStore = () => singleton ??= createStore();
