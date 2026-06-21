import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

interface BatchRow {
  BATCH_ID:    string;
  CAMPAIGN_NAME: string | null;
  TOTAL:       number;
  SENT_AT:     string | null;
}

export interface BatchSummary {
  batchId:      string;
  campaignName: string;
  total:        number;
  sentAt:       string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  try {
    const result = await query<BatchRow>(
      `SELECT
         "BATCH_ID",
         "CAMPAIGN_NAME",
         COUNT(*)  AS "TOTAL",
         MIN(TO_VARCHAR("CREATED_AT", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS "SENT_AT"
       FROM RECIPIENT_LOGS
       GROUP BY "BATCH_ID", "CAMPAIGN_NAME"
       ORDER BY "SENT_AT" DESC`,
      []
    );

    const batches: BatchSummary[] = result.rows.map((r) => ({
      batchId:      r.BATCH_ID,
      campaignName: r.CAMPAIGN_NAME ?? r.BATCH_ID,
      total:        Number(r.TOTAL),
      sentAt:       r.SENT_AT,
    }));

    return NextResponse.json({ batches });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[batches] HANA query error:', err);
    return NextResponse.json({ message: `Database error: ${detail}` }, { status: 500 });
  }
}
