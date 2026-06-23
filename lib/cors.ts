import { type NextRequest, NextResponse } from 'next/server';

/**
 * Rejects requests that originate from a different origin.
 * Call at the top of every auth-protected API route handler.
 *
 * Returns a NextResponse (403 or 405) when the request should be blocked,
 * or null when it should be allowed through.
 *
 * Logic:
 *  - No Origin header → same-origin or server-to-server → allow
 *  - Origin matches app URL → allow
 *  - Origin present but doesn't match → block with 403
 *  - OPTIONS preflight from foreign origin → block with 405
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const host   = req.headers.get('host');
  const allowed = appUrl
    ? origin === appUrl || origin === appUrl.replace(/\/$/, '')
    : (host ? origin.includes(host) : false);

  if (!allowed) {
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 405 });
    }
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  return null;
}
