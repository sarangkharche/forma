import { NextResponse, type NextRequest } from 'next/server';
import { isLocalRequest } from '@/lib/local-request.mjs';

export function proxy(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: 'Open Forma locally.' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
