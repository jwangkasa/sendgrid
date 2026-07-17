import { query } from '@/lib/db';
import { sendPersonalizedBatch } from '@/lib/sendgrid';
import { v4 as uuidv4 } from 'uuid';
import type {
  SequenceFlow, SequenceNode, RecipientRow, EmailTemplate, SequenceRunResult,
} from '@/lib/types';

interface Enrollment {
  ID: string;
  EMAIL_ADDRESS: string;
  CURRENT_NODE: string;
  NEXT_RUN_AT: string;
  LAST_BATCH_ID: string | null;
  METADATA: string | null;
}

function findNode(flow: SequenceFlow, id: string): SequenceNode | undefined {
  return flow.nodes.find((n) => n.id === id);
}

function nextNode(flow: SequenceFlow, nodeId: string, edgeLabel?: string): SequenceNode | null {
  const edges = flow.edges.filter((e) => e.source === nodeId);
  let edge = edges[0];
  if (edgeLabel) edge = edges.find((e) => e.label === edgeLabel) ?? edges[0];
  if (!edge) return null;
  return findNode(flow, edge.target) ?? null;
}

function addDuration(base: Date, amount: number, unit: 'minutes' | 'hours' | 'days'): Date {
  const d = new Date(base);
  if (unit === 'minutes') d.setMinutes(d.getMinutes() + amount);
  else if (unit === 'hours') d.setHours(d.getHours() + amount);
  else d.setDate(d.getDate() + amount);
  return d;
}

// ─── Timezone helpers for Time Window node ────────────────────────────────────

function getLocalParts(date: Date, tz: string): { hour: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', weekday: 'short', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour, day: weekdayMap[weekdayStr] ?? 1 };
}

function nextWindowOpen(now: Date, startHour: number, endHour: number, allowedDays: number[], tz: string): Date {
  const d = new Date(now);
  // try up to 8 days ahead to find the next valid window
  for (let i = 0; i < 8 * 24; i++) {
    const { hour, day } = getLocalParts(d, tz);
    if (allowedDays.includes(day) && hour >= startHour && hour < endHour) return d;
    d.setMinutes(d.getMinutes() + 60); // advance 1 hour at a time
  }
  return d;
}

// ─── Condition evaluator ──────────────────────────────────────────────────────

async function evaluateCondition(
  node: SequenceNode,
  email: string,
  lastBatchId: string | null,
): Promise<'yes' | 'no'> {
  if (!lastBatchId) return 'no';
  const { field = 'DELIVERY_STATUS', op = 'in', value = [] } = node.data;
  if ((value as string[]).length === 0) return 'no';

  const placeholders = (value as string[]).map(() => '?').join(', ');
  const rows = await query<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM RECIPIENT_LOGS
      WHERE "EMAIL_ADDRESS" = ? AND "BATCH_ID" = ? AND "${field as string}" IN (${placeholders})`,
    [email, lastBatchId, ...(value as string[])],
  );
  const matched = Number(rows.rows[0]?.CNT ?? 0) > 0;
  return op === 'not_in' ? (matched ? 'no' : 'yes') : (matched ? 'yes' : 'no');
}

// Check statuses across ALL batches for this enrollment (used by Exit and Loop)
async function hasStatusAcrossAllBatches(
  email: string,
  sequenceId: string,
  statuses: string[],
): Promise<boolean> {
  if (statuses.length === 0) return false;
  const placeholders = statuses.map(() => '?').join(', ');
  const rows = await query<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT
       FROM "HATCH"."RECIPIENT_LOGS" RL
       JOIN "HATCH"."SEQUENCE_ENROLLMENTS" SE
         ON RL.BATCH_ID = SE.LAST_BATCH_ID
      WHERE SE.SEQUENCE_ID = ? AND RL."EMAIL_ADDRESS" = ?
        AND RL."DELIVERY_STATUS" IN (${placeholders})`,
    [sequenceId, email, ...statuses],
  );
  return Number(rows.rows[0]?.CNT ?? 0) > 0;
}

// ─── Core: advance a single enrollment one step through the flow ──────────────

export async function advanceEnrollment(
  enrollmentId: string,
  sequenceId: string,
  fromEmail: string,
  fromName: string,
): Promise<'completed' | 'waiting' | 'skipped'> {
  const enrollRows = await query<Enrollment>(
    `SELECT ID, EMAIL_ADDRESS, CURRENT_NODE, NEXT_RUN_AT, LAST_BATCH_ID, METADATA
       FROM "HATCH"."SEQUENCE_ENROLLMENTS"
      WHERE ID = ? AND STATUS = 'active'`,
    [enrollmentId],
  );
  const enrollment = enrollRows.rows[0];
  if (!enrollment) return 'skipped';

  const seqRows = await query<{ FLOW_JSON: string }>(
    `SELECT FLOW_JSON FROM "HATCH"."SEQUENCES" WHERE ID = ?`, [sequenceId],
  );
  if (!seqRows.rows[0]) return 'skipped';
  const flow = JSON.parse(seqRows.rows[0].FLOW_JSON) as SequenceFlow;

  let currentNode = findNode(flow, enrollment.CURRENT_NODE);
  let lastBatchId = enrollment.LAST_BATCH_ID;
  let meta: Record<string, unknown> = enrollment.METADATA
    ? (JSON.parse(enrollment.METADATA) as Record<string, unknown>)
    : {};
  const recipient: RecipientRow = meta.EMAIL_ADDRESS
    ? (meta as unknown as RecipientRow)
    : { EMAIL_ADDRESS: enrollment.EMAIL_ADDRESS, FIRST_NAME: '', LAST_NAME: '', CATEGORY: '', COMPANY: '', PHONE_NUMBER: '', COMMENTS: '' };

  const now = new Date();
  let nextRunAt: Date | null = null;
  let completed = false;
  let metaDirty = false;

  while (currentNode) {
    if (currentNode.type === 'end') {
      completed = true;
      break;
    }

    if (currentNode.type === 'start') {
      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      continue;
    }

    if (currentNode.type === 'wait') {
      const { amount = 1, unit = 'days', date } = currentNode.data as { amount?: number; unit?: 'minutes' | 'hours' | 'days'; date?: string | null; days?: number };
      const legacyDays = (currentNode.data as { days?: number }).days;
      nextRunAt = date ? new Date(date) : addDuration(now, amount ?? legacyDays ?? 1, unit);
      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      break;
    }

    if (currentNode.type === 'condition') {
      const branch = await evaluateCondition(currentNode, enrollment.EMAIL_ADDRESS, lastBatchId);
      currentNode = nextNode(flow, currentNode.id, branch) ?? undefined!;
      continue;
    }

    if (currentNode.type === 'email') {
      const template = currentNode.data.template as EmailTemplate | undefined;
      if (template?.htmlBody || template?.textBody) {
        const batchId = uuidv4().replace(/-/g, '').slice(0, 24);
        await sendPersonalizedBatch(
          [recipient],
          { ...template, fromEmail, fromName },
          batchId,
        );
        lastBatchId = batchId;
      }
      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      break;
    }

    // ── Goal: mark converted and stop ──────────────────────────────────────────
    if (currentNode.type === 'goal') {
      meta = { ...meta, goalMet: true, goalName: currentNode.data.goalName ?? '' };
      metaDirty = true;
      completed = true;
      break;
    }

    // ── Exit: stop if recipient has a terminal status ──────────────────────────
    if (currentNode.type === 'exit') {
      const exitOn = (currentNode.data.exitOn as string[] | undefined) ?? ['Bounced', 'Dropped'];
      const shouldExit = await hasStatusAcrossAllBatches(enrollment.EMAIL_ADDRESS, sequenceId, exitOn);
      if (shouldExit) {
        meta = { ...meta, exitReason: exitOn.join(', ') };
        metaDirty = true;
        completed = true;
        break;
      }
      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      continue;
    }

    // ── Time Window: hold until within allowed hours/days ─────────────────────
    if (currentNode.type === 'timeWindow') {
      const startHour = (currentNode.data.startHour as number | undefined) ?? 9;
      const endHour   = (currentNode.data.endHour   as number | undefined) ?? 17;
      const allowedDays = (currentNode.data.allowedDays as number[] | undefined) ?? [1, 2, 3, 4, 5];
      const tz = (currentNode.data.timezone as string | undefined) ?? 'UTC';
      const { hour, day } = getLocalParts(now, tz);
      if (allowedDays.includes(day) && hour >= startHour && hour < endHour) {
        // Inside window — pass through
        currentNode = nextNode(flow, currentNode.id) ?? undefined!;
        continue;
      }
      // Outside window — schedule for next open
      nextRunAt = nextWindowOpen(now, startHour, endHour, allowedDays, tz);
      // Stay on this node so next run re-checks
      break;
    }

    // ── A/B Split: route deterministically per recipient ─────────────────────
    if (currentNode.type === 'abSplit') {
      let branch = meta.abBranch as string | undefined;
      if (!branch) {
        const pct = (currentNode.data.splitPercent as number | undefined) ?? 50;
        branch = Math.random() * 100 < pct ? 'a' : 'b';
        meta = { ...meta, abBranch: branch };
        metaDirty = true;
        await query(
          `UPDATE "HATCH"."SEQUENCE_ENROLLMENTS" SET METADATA = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?`,
          [JSON.stringify(meta), enrollment.ID],
        );
      }
      currentNode = nextNode(flow, currentNode.id, branch) ?? undefined!;
      continue;
    }

    // ── Loop: iterate up to maxIterations, exit when condition met ────────────
    if (currentNode.type === 'loop') {
      const max = (currentNode.data.maxIterations as number | undefined) ?? 3;
      const loopCond = (currentNode.data.loopCondition as string[] | undefined) ?? [];
      const loopCount = (meta.loopCount as number | undefined) ?? 0;

      // Check exit condition first (if configured)
      if (loopCond.length > 0) {
        const condMet = await hasStatusAcrossAllBatches(enrollment.EMAIL_ADDRESS, sequenceId, loopCond);
        if (condMet) {
          meta = { ...meta, loopCount: 0 };
          metaDirty = true;
          currentNode = nextNode(flow, currentNode.id, 'exit') ?? undefined!;
          continue;
        }
      }

      if (loopCount >= max) {
        meta = { ...meta, loopCount: 0 };
        metaDirty = true;
        currentNode = nextNode(flow, currentNode.id, 'exit') ?? undefined!;
        continue;
      }

      meta = { ...meta, loopCount: loopCount + 1 };
      metaDirty = true;
      await query(
        `UPDATE "HATCH"."SEQUENCE_ENROLLMENTS" SET METADATA = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?`,
        [JSON.stringify(meta), enrollment.ID],
      );
      currentNode = nextNode(flow, currentNode.id, 'loop') ?? undefined!;
      // The loop edge points back to an earlier node — the while loop will continue from there
      continue;
    }

    // ── Tag: attach a label to the recipient's enrollment metadata ────────────
    if (currentNode.type === 'tag') {
      const tagName = (currentNode.data.tagName as string | undefined)?.trim();
      if (tagName) {
        const existingTags = (meta.tags as string[] | undefined) ?? [];
        if (!existingTags.includes(tagName)) {
          meta = { ...meta, tags: [...existingTags, tagName] };
          metaDirty = true;
        }
      }
      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      continue;
    }

    // ── Unsubscribe Check: exit if recipient has any suppression status ───────
    if (currentNode.type === 'unsubscribe') {
      const suppressionStatuses = ['Bounced', 'Dropped'];
      const suppressed = await hasStatusAcrossAllBatches(enrollment.EMAIL_ADDRESS, sequenceId, suppressionStatuses);
      if (suppressed) {
        meta = { ...meta, exitReason: 'unsubscribed/suppressed' };
        metaDirty = true;
        completed = true;
        break;
      }
      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      continue;
    }

    // ── SMS: send a text message via Twilio (requires env vars) ──────────────
    if (currentNode.type === 'sms') {
      const smsBody = (currentNode.data.smsBody as string | undefined)?.trim();
      const toNumber = recipient.PHONE_NUMBER?.trim();
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken  = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;

      if (smsBody && toNumber && accountSid && authToken && fromNumber) {
        // Personalise merge tags
        const body = smsBody
          .replace(/\{\{FIRST_NAME\}\}/g, recipient.FIRST_NAME || '')
          .replace(/\{\{LAST_NAME\}\}/g,  recipient.LAST_NAME  || '')
          .replace(/\{\{COMPANY\}\}/g,    recipient.COMPANY    || '');

        try {
          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ To: toNumber, From: fromNumber, Body: body }).toString(),
            },
          );
        } catch (e) {
          console.error('[sequenceEngine] SMS send error:', e);
        }
      } else if (!accountSid || !authToken || !fromNumber) {
        console.warn('[sequenceEngine] SMS node skipped — Twilio env vars not configured');
      }

      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      break;
    }

    // Unknown node type — skip
    currentNode = nextNode(flow, currentNode.id) ?? undefined!;
  }

  if (!currentNode) completed = true;

  const metaJson = metaDirty ? JSON.stringify(meta) : enrollment.METADATA;

  if (completed) {
    await query(
      `UPDATE "HATCH"."SEQUENCE_ENROLLMENTS"
          SET STATUS = 'completed', METADATA = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ?`,
      [metaJson, enrollment.ID],
    );
    return 'completed';
  }

  const scheduleAt = nextRunAt ?? now;
  await query(
    `UPDATE "HATCH"."SEQUENCE_ENROLLMENTS"
        SET CURRENT_NODE = ?, LAST_BATCH_ID = COALESCE(?, LAST_BATCH_ID),
            NEXT_RUN_AT = ?, METADATA = ?, UPDATED_AT = CURRENT_TIMESTAMP
      WHERE ID = ?`,
    [currentNode?.id ?? enrollment.CURRENT_NODE, lastBatchId, scheduleAt.toISOString(), metaJson, enrollment.ID],
  );
  return 'waiting';
}

// ─── Orchestrator: run all due enrollments for a sequence ─────────────────────

export async function runSequence(
  sequenceId: string,
  fromEmail: string,
  fromName: string,
): Promise<SequenceRunResult> {
  const result: SequenceRunResult = { processed: 0, emailsSent: 0, completed: 0, errors: 0 };

  const now = new Date();
  const enrollments = await query<{ ID: string }>(
    `SELECT ID FROM "HATCH"."SEQUENCE_ENROLLMENTS"
      WHERE SEQUENCE_ID = ? AND STATUS = 'active' AND NEXT_RUN_AT <= ?`,
    [sequenceId, now.toISOString()],
  );

  for (const e of enrollments.rows) {
    result.processed++;
    try {
      const outcome = await advanceEnrollment(e.ID, sequenceId, fromEmail, fromName);
      if (outcome === 'completed') result.completed++;
    } catch (err) {
      console.error(`[sequenceEngine] error advancing enrollment ${e.ID}:`, err);
      result.errors++;
      await query(
        `UPDATE "HATCH"."SEQUENCE_ENROLLMENTS" SET STATUS = 'error', UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?`,
        [e.ID],
      ).catch(() => {/* non-fatal */});
    }
  }

  // Count emails sent this run for the audit log
  const sentThisRun = await query<{ EMAILS_SENT: number }>(
    `SELECT COUNT(*) AS EMAILS_SENT FROM "HATCH"."SEQUENCE_ENROLLMENTS"
      WHERE SEQUENCE_ID = ? AND UPDATED_AT >= ?`,
    [sequenceId, now.toISOString()],
  ).catch(() => null);
  result.emailsSent = Number(sentThisRun?.rows[0]?.EMAILS_SENT ?? 0);

  // Aggregate opens/clicks across all batches for this sequence run
  const engagement = await query<{ OPENS: number; CLICKS: number }>(
    `SELECT SUM(RL.OPEN_COUNT) AS OPENS, SUM(RL.CLICK_COUNT) AS CLICKS
       FROM "HATCH"."RECIPIENT_LOGS" RL
       JOIN "HATCH"."SEQUENCE_ENROLLMENTS" SE
         ON RL.BATCH_ID = SE.LAST_BATCH_ID
      WHERE SE.SEQUENCE_ID = ?`,
    [sequenceId],
  ).catch(() => null);
  const opens  = Number(engagement?.rows[0]?.OPENS  ?? 0);
  const clicks = Number(engagement?.rows[0]?.CLICKS ?? 0);

  await query(
    `INSERT INTO "HATCH"."SEQUENCE_AUDIT_LOGS"
       (ID, SEQUENCE_ID, RAN_AT, PROCESSED, EMAILS_SENT, COMPLETED, ERRORS, OPENS, CLICKS)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), sequenceId, result.processed, result.emailsSent, result.completed, result.errors, opens, clicks],
  ).catch(() => {/* non-fatal */});

  return result;
}
