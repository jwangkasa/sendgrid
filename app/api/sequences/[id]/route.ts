import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';
import type { SequenceFlow } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  let uid: string;
  try { const t = await requireAuth(req); uid = t.uid; }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;
  const rows = await query<{ ID: string; NAME: string; STATUS: string; FLOW_JSON: string; CREATED_AT: string; UPDATED_AT: string }>(
    `SELECT ID, NAME, STATUS, FLOW_JSON, CREATED_AT, UPDATED_AT FROM SEQUENCES WHERE ID = ? AND OWNER_UID = ?`,
    [id, uid],
  );
  if (!rows.rows[0]) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const row = rows.rows[0];
  return NextResponse.json({
    id: row.ID, name: row.NAME, status: row.STATUS,
    flow: JSON.parse(row.FLOW_JSON) as SequenceFlow,
    createdAt: row.CREATED_AT, updatedAt: row.UPDATED_AT,
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  let uid: string;
  try { const t = await requireAuth(req); uid = t.uid; }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;
  const { name, flow, status } = await req.json() as { name?: string; flow?: SequenceFlow; status?: string };

  await query(
    `UPDATE SEQUENCES SET NAME = COALESCE(?, NAME),
       FLOW_JSON = COALESCE(?, FLOW_JSON),
       STATUS = COALESCE(?, STATUS),
       UPDATED_AT = CURRENT_TIMESTAMP
     WHERE ID = ? AND OWNER_UID = ?`,
    [name ?? null, flow ? JSON.stringify(flow) : null, status ?? null, id, uid],
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  let uid: string;
  try { const t = await requireAuth(req); uid = t.uid; }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;
  await query(`DELETE FROM SEQUENCES WHERE ID = ? AND OWNER_UID = ?`, [id, uid]);
  return NextResponse.json({ ok: true });
}
