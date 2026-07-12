import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { SequenceFlow } from '@/lib/types';

export async function GET(req: NextRequest) {
  let uid: string;
  try {
    const token = await requireAuth(req);
    uid = token.uid;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 });
    throw e;
  }

  try {
    const rows = await query<{
      ID: string; NAME: string; STATUS: string;
      CREATED_AT: string; UPDATED_AT: string;
    }>(
      `SELECT ID, NAME, STATUS, CREATED_AT, UPDATED_AT
         FROM "HATCH"."SEQUENCES"
        WHERE OWNER_UID = ?
        ORDER BY UPDATED_AT DESC`,
      [uid],
    );
    return NextResponse.json({ sequences: rows.rows });
  } catch (e) {
    console.error('[GET /api/sequences]', e);
    return NextResponse.json({ message: 'Database error — run migrations 004 and 005', sequences: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    const token = await requireAuth(req);
    uid = token.uid;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 });
    throw e;
  }

  const { name, flow } = await req.json() as { name: string; flow: SequenceFlow };
  if (!name?.trim()) return NextResponse.json({ message: 'Name is required' }, { status: 400 });

  const id = uuidv4();
  try {
    await query(
      `INSERT INTO "HATCH"."SEQUENCES" (ID, NAME, OWNER_UID, FLOW_JSON, STATUS)
       VALUES (?, ?, ?, ?, 'draft')`,
      [id, name.trim(), uid, JSON.stringify(flow ?? { nodes: [], edges: [] })],
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/sequences]', e);
    return NextResponse.json({ message: 'Database error — run migrations 004 and 005' }, { status: 500 });
  }
}
