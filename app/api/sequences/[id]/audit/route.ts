import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

interface AuditRow {
  ID: string;
  SEQUENCE_ID: string;
  RAN_AT: string;
  PROCESSED: number;
  EMAILS_SENT: number;
  COMPLETED: number;
  ERRORS: number;
  OPENS: number;
  CLICKS: number;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try { await requireAuth(req); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;

  try {
    const rows = await query<AuditRow>(
      `SELECT TOP 50 SAL.ID, SAL.SEQUENCE_ID, SAL.RAN_AT, SAL.PROCESSED, SAL.EMAILS_SENT,
              SAL.COMPLETED, SAL.ERRORS,
              COALESCE(SUM(RL.OPEN_COUNT),  0) AS OPENS,
              COALESCE(SUM(RL.CLICK_COUNT), 0) AS CLICKS
         FROM "HATCH"."SEQUENCE_AUDIT_LOGS" SAL
         LEFT JOIN "HATCH"."SEQUENCE_ENROLLMENTS" SE
           ON SE.SEQUENCE_ID = SAL.SEQUENCE_ID
         LEFT JOIN "HATCH"."RECIPIENT_LOGS" RL
           ON RL.BATCH_ID = SE.LAST_BATCH_ID
        WHERE SAL.SEQUENCE_ID = ?
        GROUP BY SAL.ID, SAL.SEQUENCE_ID, SAL.RAN_AT, SAL.PROCESSED, SAL.EMAILS_SENT,
                 SAL.COMPLETED, SAL.ERRORS
        ORDER BY SAL.RAN_AT DESC`,
      [id],
    );

    const logs = rows.rows.map((r) => ({
      id: r.ID,
      sequenceId: r.SEQUENCE_ID,
      ranAt: r.RAN_AT,
      processed: r.PROCESSED,
      emailsSent: r.EMAILS_SENT,
      completed: r.COMPLETED,
      errors: r.ERRORS,
      opens: Number(r.OPENS ?? 0),
      clicks: Number(r.CLICKS ?? 0),
    }));

    return NextResponse.json({ logs });
  } catch (e) {
    console.error('[GET /api/sequences/[id]/audit]', e);
    return NextResponse.json({ message: 'Database error' }, { status: 500 });
  }
}
