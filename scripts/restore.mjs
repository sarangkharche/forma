import { restoreData } from '../lib/backup.mjs';
try {
  const result = await restoreData(process.argv[2], process.argv[3]);
  console.log(`Forma data restored to ${result.dataDirectory}. Your existing data is unchanged. Start Forma with TODOS_DATA_DIR set to this directory. Source configuration and external credentials are separate from this database backup.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
