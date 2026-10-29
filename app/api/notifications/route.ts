import { getStore } from '@/lib/store.mjs';
import { isLocalWrite } from '@/lib/local-request.mjs';
import { ensureState, subscribe, unsubscribe, schedule } from '@/lib/notifications.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  const state = ensureState();
  return Response.json({ publicKey: state.keys.publicKey, schedule, subscribers: Object.keys(state.subscriptions).length, lastWorkerAt: state.lastWorkerAt, lastError: state.lastError }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  if (!isLocalWrite(request)) return Response.json({ error: 'Open Forma locally to enable notifications.' }, { status: 403 });
  try { subscribe(await request.json(), getStore()); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  if (!isLocalWrite(request)) return Response.json({ error: 'Open Forma locally to disable notifications.' }, { status: 403 });
  try { const { endpoint } = await request.json(); if (typeof endpoint !== 'string') throw new Error('Missing subscription.'); unsubscribe(endpoint); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
}
