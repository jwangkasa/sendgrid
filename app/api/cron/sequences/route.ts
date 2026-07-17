import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { advanceEnrollment } from '@/lib/sequenceEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? '';
  const fromName  = process.env.SENDGRID_FROM_NAME  ?? '';
  if (!fromEmail) {
    return NextResponse.json({ message: 'SENDGRID_FROM_EMAIL not configured' }, { status: 500 });
  }

  const due = await query<{ ID: string; SEQUENCE_ID: string }>(
    `SELECT ID, SEQUENCE_ID FROM "HATCH"."SEQUENCE_ENROLLMENTS"
      WHERE "STATUS" = 'active' AND "NEXT_RUN_AT" <= CURRENT_TIMESTAMP`,
  ).catch((e) => {
    console.error('[cron/sequences] DB error:', e);
    return null;
  });

  if (!due) {
    return NextResponse.json({ message: 'Database error' }, { status: 500 });
  }

  let advanced = 0;
  let errors   = 0;

  for (const row of due.rows) {
    try {
      await advanceEnrollment(row.ID, row.SEQUENCE_ID, fromEmail, fromName);
      advanced++;
    } catch (e) {
      errors++;
      console.error(`[cron/sequences] error advancing enrollment ${row.ID}:`, e);
    }
  }

  return NextResponse.json({ advanced, errors });
}
