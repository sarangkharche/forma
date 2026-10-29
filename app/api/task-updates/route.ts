import { getStore } from '@/lib/store.mjs';
import { isLocalWrite } from '@/lib/local-request.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!request.headers.get('origin') || !isLocalWrite(request)) return Response.json({ error: 'Open Forma locally to read task updates.' }, { status: 403 });
  try {
    const { taskId, updateId } = await request.json();
    getStore().readSourceUpdates(taskId, updateId);
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
}
