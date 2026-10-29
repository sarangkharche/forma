import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isLocalWrite } from '@/lib/local-request.mjs';
export const runtime = 'nodejs';
const run = promisify(execFile);
export async function POST(request: Request) {
  if (!request.headers.get('origin') || !isLocalWrite(request)) return Response.json({error:'Open Forma locally to open Codex.'},{status:403});
  try {
    const { url } = await request.json();
    if (typeof url !== 'string' || !/^codex:\/\/threads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url)) return Response.json({error:'Invalid Codex chat link.'},{status:400});
    await run('/usr/bin/open', [url], {timeout:5000});
    return Response.json({ok:true});
  } catch {
    return Response.json({error:'Could not open Codex. Check that the desktop app is installed.'},{status:500});
  }
}
