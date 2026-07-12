import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { runSequence } from '@/lib/sequenceEngine';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try { await requireAuth(req); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ message: e.message }, { status: 401 }); throw e; }

  const { id } = await ctx.params;
  const { fromEmail, fromName } = await req.json().catch(() => ({})) as { fromEmail?: string; fromName?: string };

  const resolvedFrom = fromEmail ?? process.env.SENDGRID_FROM_EMAIL ?? '';
  if (!resolvedFrom) return NextResponse.json({ message: 'fromEmail required' }, { status: 400 });

  const result = await runSequence(id, resolvedFrom, fromName ?? resolvedFrom);
  return NextResponse.json(result);
}
