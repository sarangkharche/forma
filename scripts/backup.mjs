import { backupData } from '../lib/backup.mjs';
try { const result = await backupData(process.argv[2]); console.log(`Consistent Forma backup saved to ${result.file}. Keep it private; it contains task data and settings.`); }
catch (error) { console.error(error.message); process.exitCode = 1; }
