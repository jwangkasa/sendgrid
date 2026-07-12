import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { RecipientRow, SequenceFlow } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try { await requireAuth(req); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;

  // Load sequence to find the start node
  const seqRows = await query<{ FLOW_JSON: string }>(
    `SELECT FLOW_JSON FROM SEQUENCES WHERE ID = ?`, [id],
  );
  if (!seqRows.rows[0]) return NextResponse.json({ message: 'Sequence not found' }, { status: 404 });
  const flow = JSON.parse(seqRows.rows[0].FLOW_JSON) as SequenceFlow;
  const startNode = flow.nodes.find((n) => n.type === 'start');
  if (!startNode) return NextResponse.json({ message: 'Sequence has no Start node' }, { status: 400 });

  // Find the node after start
  const firstEdge = flow.edges.find((e) => e.source === startNode.id);
  const firstNodeId = firstEdge?.target ?? startNode.id;

  const { recipients } = await req.json() as { recipients: RecipientRow[] };
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ message: 'recipients array required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  let enrolled = 0;

  for (const recipient of recipients) {
    if (!recipient.EMAIL_ADDRESS) continue;
    // Skip if already enrolled and active
    const existing = await query<{ ID: string }>(
      `SELECT ID FROM SEQUENCE_ENROLLMENTS WHERE SEQUENCE_ID = ? AND EMAIL_ADDRESS = ? AND STATUS = 'active'`,
      [id, recipient.EMAIL_ADDRESS],
    );
    if (existing.rows.length > 0) continue;

    await query(
      `INSERT INTO SEQUENCE_ENROLLMENTS
         (ID, SEQUENCE_ID, EMAIL_ADDRESS, CURRENT_NODE, STATUS, NEXT_RUN_AT, METADATA)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [uuidv4(), id, recipient.EMAIL_ADDRESS, firstNodeId, now, JSON.stringify(recipient)],
    );
    enrolled++;
  }

  return NextResponse.json({ enrolled });
}
