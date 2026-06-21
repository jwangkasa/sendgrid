/**
 * app/api/webhooks/sendgrid/route.ts
 *
 * POST /api/webhooks/sendgrid
 *
 * Publicly accessible — no Authorization header required.
 * SendGrid delivers signed batches of events to this endpoint.
 *
 * Pipeline:
 *   1. Collect raw body bytes (signature verification requires the exact payload)
 *   2. Verify ECDSA signature via @sendgrid/eventwebhook
 *   3. Parse the JSON event array
 *   4. For each event, execute a conditional HANA UPDATE only when the incoming
 *      event timestamp is strictly newer than the row's current UPDATED_AT —
 *      this guards against out-of-order webhook delivery
 *   5. State machine: advance DELIVERY_STATUS and increment counters per event type
 *
 * HANA UPSERT strategy:
 *   HANA Cloud does not support a native UPSERT / MERGE on arbitrary conditions
 *   without a full MERGE statement. We use a conditional UPDATE with a timestamp
 *   guard in the WHERE clause. Rows that don't exist yet (sg_message_id not yet
 *   written back from the processed event) are silently skipped — a second
 *   delivery of the same event will succeed once the ID is present.
 *
 * SendGrid event → state machine:
 *   processed  → Processed  (no counter)
 *   delivered  → Delivered  (no counter)
 *   open       → Opened     (OPEN_COUNT  +1, idempotent timestamp guard)
 *   click      → Clicked    (CLICK_COUNT +1, idempotent timestamp guard)
 *   bounce     → Bounced    (captures reason)
 *   dropped    → Dropped    (captures reason)
 *   deferred   → no state change (transient; logged only)
 *   spamreport → Bounced    (treat as terminal failure)
 */

import { NextRequest, NextResponse } from 'next/server';
import { EventWebhook, EventWebhookHeader } from '@sendgrid/eventwebhook';
import { FieldValue } from 'firebase-admin/firestore';
import { execute, query } from '@/lib/db';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { SendGridWebhookEvent, SendGridEventType, DeliveryStatus } from '@/lib/types';

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(
  publicKey: string,
  payload: Buffer,
  signature: string,
  timestamp: string
): boolean {
  try {
    const ew = new EventWebhook();
    const ecPublicKey = ew.convertPublicKeyToECDSA(publicKey);
    return ew.verifySignature(ecPublicKey, payload, signature, timestamp);
  } catch {
    return false;
  }
}

// ─── State machine: event type → (new status, increment field) ───────────────

interface EventAction {
  newStatus:        DeliveryStatus | null;  // null = no status change
  incrementOpen:    boolean;
  incrementClick:   boolean;
  captureReason:    boolean;
  // terminal events must not be overwritten by later transient events
  isTerminal:       boolean;
}

const EVENT_ACTIONS: Partial<Record<SendGridEventType, EventAction>> = {
  processed: {
    newStatus: 'Processed', incrementOpen: false, incrementClick: false,
    captureReason: false,   isTerminal: false,
  },
  delivered: {
    newStatus: 'Delivered', incrementOpen: false, incrementClick: false,
    captureReason: false,   isTerminal: false,
  },
  open: {
    newStatus: 'Opened',    incrementOpen: true,  incrementClick: false,
    captureReason: false,   isTerminal: false,
  },
  click: {
    newStatus: 'Clicked',   incrementOpen: false, incrementClick: true,
    captureReason: false,   isTerminal: false,
  },
  bounce: {
    newStatus: 'Bounced',   incrementOpen: false, incrementClick: false,
    captureReason: true,    isTerminal: true,
  },
  dropped: {
    newStatus: 'Dropped',   incrementOpen: false, incrementClick: false,
    captureReason: true,    isTerminal: true,
  },
  spamreport: {
    newStatus: 'Bounced',   incrementOpen: false, incrementClick: false,
    captureReason: true,    isTerminal: true,
  },
};

// ─── Per-event HANA update ────────────────────────────────────────────────────
//
// We look up the row by (EMAIL_ADDRESS, BATCH_ID) because sg_message_id is
// only populated after the `processed` event arrives. For the `processed`
// event itself we also write SG_MESSAGE_ID from the event payload.
//
// The timestamp guard in the WHERE clause (`UPDATED_AT <= ?`) ensures we never
// regress state due to out-of-order delivery.

async function processEvent(event: SendGridWebhookEvent): Promise<void> {
  const batchId   = event.custom_args?.batch_id;
  const email     = event.email ?? event.custom_args?.email;
  const eventType = event.event;
  const action    = EVENT_ACTIONS[eventType];

  console.log(`[webhook] processEvent: type=${eventType} email=${email} batchId=${batchId} hasAction=${!!action}`);

  if (!batchId || !email || !action) {
    console.warn(`[webhook] skipping event — missing: batchId=${!batchId} email=${!email} action=${!action}`);
    return;
  }

  // Convert Unix epoch seconds → ISO timestamp string for HANA TIMESTAMP comparison
  const eventTs = new Date(event.timestamp * 1000).toISOString();

  // ── Terminal-event guard: never overwrite Bounced/Dropped with a later event ─
  if (!action.isTerminal) {
    const { rows } = await query<{ DELIVERY_STATUS: string }>(
      `SELECT "DELIVERY_STATUS"
         FROM RECIPIENT_LOGS
        WHERE "EMAIL_ADDRESS" = ? AND "BATCH_ID" = ?`,
      [email, batchId]
    );
    if (
      rows.length > 0 &&
      (rows[0]!.DELIVERY_STATUS === 'Bounced' || rows[0]!.DELIVERY_STATUS === 'Dropped')
    ) {
      return;
    }
  }

  // ── Build the UPDATE dynamically based on event action ────────────────────
  const setClauses: string[]  = [];
  const params: unknown[]     = [];

  if (action.newStatus) {
    setClauses.push('"DELIVERY_STATUS" = ?');
    params.push(action.newStatus);
  }

  if (action.incrementOpen) {
    setClauses.push('"OPEN_COUNT" = "OPEN_COUNT" + 1');
  }

  if (action.incrementClick) {
    setClauses.push('"CLICK_COUNT" = "CLICK_COUNT" + 1');
  }

  if (action.captureReason && event.reason) {
    setClauses.push('"FAILURE_REASON" = ?');
    params.push(String(event.reason).slice(0, 500));
  }

  // Always write sg_message_id when present (first arrives on `processed`)
  if (event.sg_message_id) {
    setClauses.push('"SG_MESSAGE_ID" = ?');
    params.push(event.sg_message_id.slice(0, 100));
  }

  // Always advance UPDATED_AT
  setClauses.push('"UPDATED_AT" = ?');
  params.push(eventTs);

  if (setClauses.length === 0) return;

  // Timestamp guard: only apply if event is newer than the last mutation
  params.push(email, batchId, eventTs);

  const sql = `
    UPDATE RECIPIENT_LOGS
       SET ${setClauses.join(', ')}
     WHERE "EMAIL_ADDRESS" = ?
       AND "BATCH_ID"      = ?
       AND "UPDATED_AT"   <= ?
  `.trim();

  await execute(sql, params);
  console.log(`[webhook] HANA updated: event=${eventType} email=${email} batchId=${batchId}`);

  // Mirror to Firestore — non-fatal if the campaign doc doesn't exist
  try {
    const db = getAdminFirestore();
    const recipientRef = db
      .collection('campaigns').doc(batchId)
      .collection('recipients').doc(email);

    const update: Record<string, unknown> = { updatedAt: eventTs };
    if (action.newStatus)      update['deliveryStatus'] = action.newStatus;
    if (action.incrementOpen)  update['openCount']      = FieldValue.increment(1);
    if (action.incrementClick) update['clickCount']     = FieldValue.increment(1);
    if (action.captureReason && event.reason) update['failureReason'] = String(event.reason).slice(0, 500);
    if (event.sg_message_id)   update['sgMessageId']   = event.sg_message_id.slice(0, 100);

    await recipientRef.update(update);
  } catch {
    // Firestore update is best-effort — HANA is the source of truth
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

// Tell Next.js not to parse the body — we need the raw bytes for ECDSA verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Read raw body bytes ──────────────────────────────────────────────────
  const rawBody = Buffer.from(await req.arrayBuffer());
  console.log('[webhook] POST received, body size:', rawBody.length);

  // ── 2. Signature verification ───────────────────────────────────────────────
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ?? '';
  if (!publicKey) {
    console.error('[webhook] SENDGRID_WEBHOOK_PUBLIC_KEY is not set');
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ message: 'Webhook not configured' }, { status: 500 });
    }
    console.warn('[webhook] Skipping signature verification — dev mode');
  } else {
    const signature = req.headers.get(EventWebhookHeader.SIGNATURE()) ?? '';
    const timestamp = req.headers.get(EventWebhookHeader.TIMESTAMP())  ?? '';
    console.log('[webhook] signature present:', !!signature, '| timestamp present:', !!timestamp);

    if (!signature || !timestamp) {
      console.warn('[webhook] Missing signature headers');
      return NextResponse.json({ message: 'Missing webhook signature headers' }, { status: 400 });
    }

    const valid = verifySignature(publicKey, rawBody, signature, timestamp);
    console.log('[webhook] signature valid:', valid);
    if (!valid) {
      console.warn('[webhook] Invalid SendGrid signature — rejecting payload');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 403 });
    }
  }

  // ── 3. Parse event payload ──────────────────────────────────────────────────
  let events: SendGridWebhookEvent[];
  try {
    events = JSON.parse(rawBody.toString('utf-8')) as SendGridWebhookEvent[];
    if (!Array.isArray(events)) throw new Error('Payload is not an array');
    console.log(`[webhook] parsed ${events.length} events:`, events.map((e) => `${e.event}:${e.email}`).join(', '));
    console.log('[webhook] raw first event:', JSON.stringify(events[0]));
  } catch (err) {
    console.error('[webhook] JSON parse error:', err);
    return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 });
  }

  // ── 4 & 5. Process each event concurrently (bounded to 20 parallel DB ops) ─
  const CONCURRENCY = 20;
  let processed     = 0;
  let errors        = 0;

  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((e) => processEvent(e)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        processed++;
      } else {
        errors++;
        console.error('[webhook] Event processing error:', r.reason);
      }
    }
  }

  // SendGrid expects a 2xx response — returning anything else causes retries
  return NextResponse.json(
    { received: events.length, processed, errors },
    { status: 200 }
  );
}
