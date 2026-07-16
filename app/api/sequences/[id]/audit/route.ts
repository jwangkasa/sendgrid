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
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try { await requireAuth(req); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;

  try {
    const rows = await query<AuditRow>(
      `SELECT TOP 50 ID, SEQUENCE_ID, RAN_AT, PROCESSED, EMAILS_SENT, COMPLETED, ERRORS
         FROM "HATCH"."SEQUENCE_AUDIT_LOGS"
        WHERE SEQUENCE_ID = ?
        ORDER BY RAN_AT DESC`,
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
    }));

    return NextResponse.json({ logs });
  } catch (e) {
    console.error('[GET /api/sequences/[id]/audit]', e);
    return NextResponse.json({ message: 'Database error' }, { status: 500 });
  }
}
