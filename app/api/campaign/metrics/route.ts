/**
 * app/api/campaign/metrics/route.ts
 *
 * GET /api/campaign/metrics?batchId=<BATCH_ID>
 *
 * Rapid read layer for the Phase 4 dashboard polling loop.
 *
 * Returns:
 *   - Per-status aggregate counts
 *   - Computed delivery / open / click rates (0–100, 2dp)
 *   - Full recipient row listing for the TanStack Table grid
 *
 * Two queries are issued:
 *   1. Aggregate: GROUP BY DELIVERY_STATUS — single pass, HANA column store
 *      makes this extremely fast even at 100k rows
 *   2. Row listing: full SELECT for the table — ordered by UPDATED_AT DESC
 *      so the most recently mutated rows surface at the top
 *
 * Both run concurrently (Promise.all) to minimise latency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';
import type { MetricsResponseBody, RecipientLog } from '@/lib/types';

// ─── Aggregate query shape ────────────────────────────────────────────────────

interface StatusCount {
  DELIVERY_STATUS: string;
  CNT:             number;
  TOTAL_OPENS:     number;
  TOTAL_CLICKS:    number;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Authentication ───────────────────────────────────────────────────────
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  // ── 2. Validate batchId param ───────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get('batchId')?.trim();

  if (!batchId) {
    return NextResponse.json({ message: 'Missing required query parameter: batchId' }, { status: 400 });
  }
  if (batchId.length > 50) {
    return NextResponse.json({ message: 'batchId exceeds maximum length of 50 characters' }, { status: 400 });
  }

  // ── 3. Run aggregate + row-list queries concurrently ────────────────────────
  let aggregateRows: StatusCount[];
  let recipientRows: RecipientLog[];

  try {
    const [aggregateResult, recipientResult] = await Promise.all([
      // Aggregate: one row per DELIVERY_STATUS with sum of counters
      query<StatusCount>(
        `SELECT
           "DELIVERY_STATUS",
           COUNT(*)               AS "CNT",
           SUM("OPEN_COUNT")      AS "TOTAL_OPENS",
           SUM("CLICK_COUNT")     AS "TOTAL_CLICKS"
         FROM RECIPIENT_LOGS
         WHERE "BATCH_ID" = ?
         GROUP BY "DELIVERY_STATUS"`,
        [batchId]
      ),

      // Full row list for table rendering — most recently updated first
      query<RecipientLog>(
        `SELECT
           "ID",
           "FIRST_NAME",
           "LAST_NAME",
           "CATEGORY",
           "COMPANY",
           "EMAIL_ADDRESS",
           "PHONE_NUMBER",
           "COMMENTS",
           "BATCH_ID",
           "SG_MESSAGE_ID",
           "DELIVERY_STATUS",
           "OPEN_COUNT",
           "CLICK_COUNT",
           "FAILURE_REASON",
           TO_VARCHAR("CREATED_AT", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "CREATED_AT",
           TO_VARCHAR("UPDATED_AT", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "UPDATED_AT"
         FROM RECIPIENT_LOGS
         WHERE "BATCH_ID" = ?
         ORDER BY "UPDATED_AT" DESC`,
        [batchId]
      ),
    ]);

    aggregateRows  = aggregateResult.rows;
    recipientRows  = recipientResult.rows;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[metrics] HANA query error:', err);
    return NextResponse.json({ message: `Database error while fetching metrics: ${detail}` }, { status: 500 });
  }

  // ── 4. Build aggregate counters from result set ──────────────────────────────

  const counts: Record<string, number> = {};
  let totalOpens  = 0;
  let totalClicks = 0;

  for (const row of aggregateRows) {
    const status = row.DELIVERY_STATUS ?? 'Pending';
    counts[status]  = (counts[status] ?? 0) + Number(row.CNT ?? 0);
    totalOpens     += Number(row.TOTAL_OPENS  ?? 0);
    totalClicks    += Number(row.TOTAL_CLICKS ?? 0);
  }

  const total     = Object.values(counts).reduce((s, n) => s + n, 0);
  const delivered = (counts['Delivered'] ?? 0) + (counts['Opened'] ?? 0) + (counts['Clicked'] ?? 0);
  const opened    = counts['Opened']  ?? 0;
  const clicked   = counts['Clicked'] ?? 0;
  const bounced   = counts['Bounced'] ?? 0;
  const dropped   = counts['Dropped'] ?? 0;
  const failed    = counts['Failed']  ?? 0;
  const pending   = (counts['Pending']   ?? 0) +
                    (counts['Queued']    ?? 0) +
                    (counts['Processed'] ?? 0);

  const rate = (num: number, denom: number): number =>
    denom === 0 ? 0 : Math.round((num / denom) * 10000) / 100;

  const body: MetricsResponseBody = {
    batchId,
    total,
    delivered,
    opened:       totalOpens,   // sum of OPEN_COUNT (counts multiple opens)
    clicked:      totalClicks,  // sum of CLICK_COUNT
    bounced,
    dropped,
    failed,
    pending,
    deliveryRate: rate(delivered, total),
    openRate:     rate(opened, delivered),
    clickRate:    rate(clicked, delivered),
    rows:         recipientRows,
  };

  // Cache-Control: no-store ensures the polling SWR hook always hits the server
  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
