import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { sendPersonalizedBatch } from '@/lib/sendgrid';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 });
    throw e;
  }

  const { to, subject, htmlBody, fromEmail, fromName } = await req.json() as {
    to: string;
    subject: string;
    htmlBody: string;
    fromEmail?: string;
    fromName?: string;
  };

  if (!to || !subject || !htmlBody) {
    return NextResponse.json({ message: 'Missing required fields: to, subject, htmlBody' }, { status: 400 });
  }

  const resolvedFrom = fromEmail ?? process.env.SENDGRID_FROM_EMAIL ?? '';
  if (!resolvedFrom) {
    return NextResponse.json({ message: 'No sender email configured. Set SENDGRID_FROM_EMAIL env var.' }, { status: 400 });
  }

  try {
    await sendPersonalizedBatch(
      [{ EMAIL_ADDRESS: to, FIRST_NAME: '', LAST_NAME: '', CATEGORY: '', COMPANY: '', PHONE_NUMBER: '', COMMENTS: '' }],
      { subject, htmlBody, textBody: '', fromEmail: resolvedFrom, fromName: fromName ?? resolvedFrom },
      uuidv4(),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Send failed';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
