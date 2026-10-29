import { runNotifications } from '../lib/notifications.mjs';
let running = false;
async function tick() { if (running) return; running = true; try { await runNotifications(); } catch { console.error('Forma notification worker could not complete its check.'); } finally { running = false; } }
await tick();
setInterval(tick, 15000);
