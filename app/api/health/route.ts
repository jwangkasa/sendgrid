import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await query<{ DUMMY: string }>('SELECT * FROM DUMMY', []);
    return NextResponse.json({
      hana: 'ok',
      dummy: rows[0],
      schema: process.env.HANA_SCHEMA ?? '(not set)',
      host:   process.env.HANA_HOST   ?? '(not set)',
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ hana: 'error', detail }, { status: 500 });
  }
}
