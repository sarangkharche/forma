import { readFileSync } from 'node:fs';
import { createStore } from '../lib/store.mjs';
const store = createStore();
try {
  if (process.argv.includes('--export')) console.log(JSON.stringify(store.snapshot(), null, 2));
  else if (process.argv.includes('--configure-calendar')) { store.configureCalendar(process.argv[process.argv.indexOf('--configure-calendar') + 1]); console.log('Work calendar account saved.'); }
  else if (process.argv.includes('--configure-sync')) {
    store.configureSync(JSON.parse(readFileSync(process.argv[process.argv.indexOf('--configure-sync') + 1], 'utf8')));
    console.log('Background schedule saved.');
  } else {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: npm run ingest -- /absolute/path/to/batch.json');
    console.log(JSON.stringify(store.ingest(JSON.parse(readFileSync(file, 'utf8')))));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { store.close(); }
