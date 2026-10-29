import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, openSync, closeSync, chmodSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export const dataDirectory = () => resolve(process.env.TODOS_DATA_DIR || join(process.cwd(), '.todos'));
function inspect(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('The backup failed its SQLite integrity check.');
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    if (!['tasks','meta','activity'].every(name => tables.has(name))) throw new Error('Choose a Forma SQLite backup.');
    for (const table of ['tasks','meta','activity']) for (const row of db.prepare(`SELECT data FROM ${table}`).all()) JSON.parse(row.data);
    return db;
  } catch (error) { db.close(); if (error instanceof SyntaxError) throw new Error('The Forma backup contains invalid saved data.'); throw error; }
}
export async function backupData(file, directory = dataDirectory()) {
  if (!file || !isAbsolute(file)) throw new Error('Choose an absolute path for a new backup file.');
  const source = join(directory, 'tasks.sqlite');
  if (!existsSync(source)) throw new Error('There is no Forma database to back up in this data directory.');
  if (!existsSync(dirname(file))) throw new Error('Create the backup parent directory first.');
  const db = inspect(source);
  let reserved = false;
  try {
    const fd = openSync(file, 'wx', 0o600); closeSync(fd); reserved = true;
    await backup(db, file); chmodSync(file, 0o600);
    const checked = inspect(file); checked.close();
    return { file, dataDirectory: directory };
  } catch (error) {
    if (reserved) rmSync(file, { force: true });
    if (error.code === 'EEXIST') throw new Error('That backup path already exists. Choose a new file.');
    throw error;
  } finally { db.close(); }
}
export async function restoreData(file, destination) {
  if (!file || !destination || !isAbsolute(file) || !isAbsolute(destination)) throw new Error('Use absolute paths for the backup and a new data directory.');
  if (!existsSync(file)) throw new Error('The selected backup does not exist.');
  if (existsSync(destination)) throw new Error('Restore needs a new directory. Existing data is never overwritten.');
  if (!existsSync(dirname(destination))) throw new Error('Create the destination parent directory first.');
  const db = inspect(file);
  let created = false;
  try {
    mkdirSync(destination, { mode: 0o700 }); created = true;
    const target = join(destination, 'tasks.sqlite');
    await backup(db, target); chmodSync(target, 0o600);
    const checked = inspect(target); checked.close();
    return { dataDirectory: destination };
  } catch (error) {
    // A failed restore keeps its new directory for inspection instead of deleting a user supplied path.
    if (created) error.message = 'Restore did not finish. Existing data is unchanged. The new directory was kept for inspection; choose a new destination before retrying.';
    throw error;
  } finally { db.close(); }
}
