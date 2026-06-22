import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';

export interface SenderOption {
  email: string;
  name:  string;
}

/**
 * GET /api/campaign/senders
 *
 * Returns the list of verified sender identities available for campaigns.
 * Reads SENDGRID_VERIFIED_SENDERS from the environment — a JSON array of
 * { email, name } objects.  Falls back to SENDGRID_FROM_EMAIL / SENDGRID_FROM_NAME
 * if the variable is absent so existing deployments keep working.
 *
 * Example env value:
 *   [{"email":"joni.wong@hatchevent.com","name":"Joni from HatchEvent"},{"email":"hello@hatchevent.com","name":"HatchEvent Team"}]
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  const raw = process.env.SENDGRID_VERIFIED_SENDERS;
  if (raw) {
    try {
      const senders = JSON.parse(raw) as SenderOption[];
      if (Array.isArray(senders) && senders.length > 0) {
        return NextResponse.json({ senders });
      }
    } catch {
      console.error('[senders] Failed to parse SENDGRID_VERIFIED_SENDERS — falling back to default sender');
    }
  }

  // Fallback: build a single entry from the legacy env vars
  const email = process.env.SENDGRID_FROM_EMAIL ?? '';
  const name  = process.env.SENDGRID_FROM_NAME  ?? '';
  if (!email) {
    return NextResponse.json({ message: 'No verified senders configured' }, { status: 500 });
  }

  return NextResponse.json({ senders: [{ email, name }] });
}
