import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export class CodexBridge {
  constructor() { this.nextId = 0; this.pending = new Map(); this.child = null; this.ready = null; }
  async connect() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.child = spawn('codex', ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'ignore'] });
      const child = this.child;
      child.on('error', () => { if (this.child === child) this.disconnect(); });
      child.on('exit', () => { if (this.child === child) this.disconnect(); });
      createInterface({ input: this.child.stdout }).on('line', line => {
        let message; try { message = JSON.parse(line); } catch { return; }
        if (message.method === 'turn/completed' && message.params?.threadId) {
          // Release finished chats so the desktop can accept the user's next message.
          void this.request('thread/unsubscribe', { threadId: message.params.threadId }).catch(() => {});
        }
        const waiting = this.pending.get(message.id);
        if (waiting) { this.pending.delete(message.id); clearTimeout(waiting.timer); if (message.error) waiting.reject(new Error(message.error.message || 'Codex rejected this request.')); else waiting.resolve(message.result); }
        else if (message.id !== undefined && message.method) {
          // This client never grants tool permissions or answers questions for the user.
          this.child?.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Forma cannot answer this request. Continue in Codex.' } }) + '\n');
        }
      });
      await this.request('initialize', { clientInfo: { name: 'forma_local', version: '1.0.0' }, capabilities: { experimentalApi: true } });
      this.child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    })();
    try { await this.ready; } catch (error) { this.close(); throw error; }
  }
  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Codex did not respond within 15 seconds.')); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      if (!this.child?.stdin.writable) { clearTimeout(timer); this.pending.delete(id); reject(new Error('Codex is disconnected.')); return; }
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  async call(method, params) { await this.connect(); return this.request(method, params); }
  disconnect() { for (const value of this.pending.values()) { clearTimeout(value.timer); value.reject(new Error('Codex connection closed.')); } this.pending.clear(); this.child = null; this.ready = null; }
  close() { const child = this.child; this.disconnect(); child?.kill(); }
}
