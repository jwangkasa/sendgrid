import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try { await requireAuth(req); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;

  const rows = await query<{ CURRENT_NODE: string; STATUS: string; CNT: number }>(
    `SELECT CURRENT_NODE, STATUS, COUNT(*) AS CNT
       FROM SEQUENCE_ENROLLMENTS
      WHERE SEQUENCE_ID = ?
      GROUP BY CURRENT_NODE, STATUS`,
    [id],
  );

  const totals = await query<{ STATUS: string; CNT: number }>(
    `SELECT STATUS, COUNT(*) AS CNT
       FROM SEQUENCE_ENROLLMENTS
      WHERE SEQUENCE_ID = ?
      GROUP BY STATUS`,
    [id],
  );

  return NextResponse.json({ byNode: rows.rows, totals: totals.rows });
}
