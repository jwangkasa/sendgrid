/**
 * app/api/campaign/dispatch/route.ts
 *
 * POST /api/campaign/dispatch
 *
 * Pipeline:
 *   1. Firebase JWT verification
 *   2. Zod request body validation
 *   3. Batch INSERT all recipients into RECIPIENT_LOGS (single HANA transaction)
 *   4. Chunk recipients into ≤ 1,000-record SendGrid Personalizations payloads
 *   5. Fire all SendGrid chunks concurrently (bounded parallelism: 5 in-flight)
 *   6. Return DispatchResponseBody
 *
 * On any SendGrid failure the HANA rows are already persisted with status
 * 'Pending' — the webhook sink will advance their state as events arrive.
 * This is intentional: it preserves full observability even for partial failures.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { transaction } from '@/lib/db';
import { sendPersonalizedBatch } from '@/lib/sendgrid';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { DispatchResponseBody, RecipientRow, CampaignDoc, CampaignRecipientDoc } from '@/lib/types';

// ─── Request schema ───────────────────────────────────────────────────────────

const RecipientSchema = z.object({
  FIRST_NAME:    z.string().default(''),
  LAST_NAME:     z.string().default(''),
  EMAIL_ADDRESS: z.string().email('Invalid email address in recipient list'),
  CATEGORY:      z.string().default(''),
  COMPANY:       z.string().default(''),
  PHONE_NUMBER:  z.string().default(''),
  COMMENTS:      z.string().default(''),
}).catchall(z.string());

const TemplateSchema = z.object({
  subject:  z.string().min(1, 'Subject line is required'),
  htmlBody: z.string().default(''),
  textBody: z.string().default(''),
});

const DispatchBodySchema = z.object({
  campaignName: z.string().min(1, 'Campaign name is required').max(120),
  recipients: z
    .array(RecipientSchema)
    .min(1, 'At least one recipient is required')
    .max(100_000, 'Maximum 100,000 recipients per dispatch'),
  template:   TemplateSchema,
  batchId:    z.string().min(1).max(50),
});

// ─── Constants ────────────────────────────────────────────────────────────────

const SG_CHUNK_SIZE         = 1000;  // SendGrid Personalizations ceiling
const SG_CONCURRENCY_LIMIT  = 5;     // Max simultaneous SendGrid HTTP calls

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Run promises in pools of `limit` at a time to avoid exhausting TCP sockets */
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await tasks[current]!();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Authentication ───────────────────────────────────────────────────────
  let callerEmail: string | undefined;
  try {
    const auth = await requireAuth(req);
    callerEmail = auth.email;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  // ── 2. Parse & validate body ────────────────────────────────────────────────
  let body: z.infer<typeof DispatchBodySchema>;
  try {
    const raw = await req.json();
    body = DispatchBodySchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Invalid request body';
    return NextResponse.json({ message }, { status: 400 });
  }

  const { campaignName, recipients, template, batchId } = body;
  const now = new Date().toISOString();

  // ── 3. Batch INSERT into RECIPIENT_LOGS (single transaction) ────────────────
  const rowIds: string[] = recipients.map(() => uuidv4());
  const toParam = (v: string | null | undefined): string =>
    v === null || v === undefined ? '' : v;

  try {
    await transaction(async (exec) => {
      const INSERT_SQL = `
        INSERT INTO RECIPIENT_LOGS (
          "ID", "FIRST_NAME", "LAST_NAME", "CATEGORY", "COMPANY",
          "EMAIL_ADDRESS", "PHONE_NUMBER", "COMMENTS",
          "BATCH_ID", "CAMPAIGN_NAME", "DELIVERY_STATUS", "OPEN_COUNT", "CLICK_COUNT",
          "CREATED_AT", "UPDATED_AT"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 0, 0, ?, ?)
      `.trim();

      const insertChunks = chunk(recipients, 500);
      for (let ci = 0; ci < insertChunks.length; ci++) {
        const chunkRecipients = insertChunks[ci]!;
        const baseIndex       = ci * 500;
        for (let i = 0; i < chunkRecipients.length; i++) {
          const r = chunkRecipients[i]! as RecipientRow;
          await exec(INSERT_SQL, [
            rowIds[baseIndex + i]!,
            toParam(r.FIRST_NAME),
            toParam(r.LAST_NAME),
            toParam(r.CATEGORY),
            toParam(r.COMPANY),
            r.EMAIL_ADDRESS,
            toParam(r.PHONE_NUMBER),
            toParam(r.COMMENTS),
            batchId,
            campaignName,
            now,
            now,
          ]);
        }
      }
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[dispatch] HANA INSERT error:', err);
    return NextResponse.json({ message: `Database error: ${detail}` }, { status: 500 });
  }

  // ── 4 & 5. Chunk + dispatch via SendGrid ────────────────────────────────────
  const sgChunks  = chunk(recipients as RecipientRow[], SG_CHUNK_SIZE);
  let totalAccepted = 0;

  const sendTasks = sgChunks.map((chunkRecipients) => async () => {
    const result = await sendPersonalizedBatch(chunkRecipients, template, batchId);
    if (result.statusCode >= 200 && result.statusCode < 300) {
      totalAccepted += result.count;
    } else {
      console.warn(`[dispatch] SendGrid chunk returned ${result.statusCode} for batch ${batchId}`);
    }
    return result;
  });

  let sendgridError = false;
  try {
    await pLimit(sendTasks, SG_CONCURRENCY_LIMIT);
  } catch (err) {
    console.error('[dispatch] SendGrid send error:', err);
    sendgridError = true;
  }

  // ── 6. Write campaign + recipients to Firestore ─────────────────────────────
  try {
    const db = getAdminFirestore();
    const campaignStatus = sendgridError
      ? 'failed'
      : totalAccepted < recipients.length ? 'partial' : 'dispatched';

    // Detect source: vendor selections have no fileName and use vendor field names
    const source = recipients.some((r) => (r as RecipientRow)['Title'] !== undefined)
      ? 'vendor'
      : 'excel';

    const campaignDoc: CampaignDoc = {
      batchId,
      name:             campaignName,
      subject:          template.subject,
      htmlBody:         template.htmlBody,
      textBody:         template.textBody,
      totalRecipients:  recipients.length,
      sendgridAccepted: totalAccepted,
      createdBy:        callerEmail ?? 'unknown',
      createdAt:        now,
      status:           campaignStatus,
      source,
    };

    const campaignRef = db.collection('campaigns').doc(batchId);
    await campaignRef.set(campaignDoc);

    // Write recipients as a subcollection in batches of 500 (Firestore limit)
    const recipientChunks = chunk(recipients as RecipientRow[], 500);
    for (const rChunk of recipientChunks) {
      const batch = db.batch();
      for (const r of rChunk) {
        const recipDoc: CampaignRecipientDoc = {
          email:          r.EMAIL_ADDRESS,
          firstName:      r.FIRST_NAME,
          lastName:       r.LAST_NAME,
          company:        r.COMPANY,
          category:       r.CATEGORY,
          deliveryStatus: 'Pending',
          openCount:      0,
          clickCount:     0,
          sgMessageId:    null,
          failureReason:  null,
          updatedAt:      now,
        };
        batch.set(campaignRef.collection('recipients').doc(r.EMAIL_ADDRESS), recipDoc);
      }
      await batch.commit();
    }
  } catch (err) {
    // Firestore write failure is non-fatal — HANA is the source of truth
    console.error('[dispatch] Firestore write error:', err);
  }

  // ── 7. Response ─────────────────────────────────────────────────────────────
  if (sendgridError) {
    return NextResponse.json(
      {
        message: 'Recipients persisted but SendGrid delivery encountered errors. Check the dashboard.',
        batchId,
        totalQueued:      recipients.length,
        sendgridAccepted: totalAccepted,
      } satisfies DispatchResponseBody,
      { status: 207 }
    );
  }

  return NextResponse.json(
    {
      batchId,
      totalQueued:      recipients.length,
      sendgridAccepted: totalAccepted,
      message: `Campaign dispatched. ${totalAccepted} of ${recipients.length} accepted by SendGrid.`,
    } satisfies DispatchResponseBody,
    { status: 202 }
  );
}
