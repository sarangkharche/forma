import { getStore } from "@/lib/store.mjs";
import { isLocalWrite } from "@/lib/local-request.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return Response.json(getStore().snapshot(), { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  if (!isLocalWrite(request)) return Response.json({ error: "Open this app locally to edit tasks." }, { status: 403 });
  try { return Response.json(getStore().create(await request.json(), request.headers.get("idempotency-key")), { status: 201 }); }
  catch (error) { const e = error as Error & { status?: number }; return Response.json({ error: e.message }, { status: e.status || 400 }); }
}
export async function PATCH(request: Request) {
  if (!isLocalWrite(request)) return Response.json({ error: "Open this app locally to edit tasks." }, { status: 403 });
  try {
    const { id, version, ...changes } = await request.json();
    return Response.json(getStore().update(id, changes, version));
  } catch (error) { const e = error as Error & { status?: number }; return Response.json({ error: e.message }, { status: e.status || 400 }); }
}
