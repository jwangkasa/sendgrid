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
 *  - Origin host matches the request Host header → allow
 *  - Origin present but host differs → block with 403
 *  - OPTIONS preflight from foreign origin → block with 405
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  // Extract just the host from the Origin header (strips protocol and trailing slash)
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const requestHost = req.headers.get('host') ?? '';

  if (originHost !== requestHost) {
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 405 });
    }
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  return null;
}
