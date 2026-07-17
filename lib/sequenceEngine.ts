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

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function evaluateCondition(
  node: SequenceNode,
  email: string,
  lastBatchId: string | null,
): Promise<'yes' | 'no'> {
  if (!lastBatchId) return 'no';
  const { field = 'DELIVERY_STATUS', op = 'in', value = [] } = node.data;
  if (value.length === 0) return 'no';

  const placeholders = value.map(() => '?').join(', ');
  const rows = await query<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM RECIPIENT_LOGS
      WHERE "EMAIL_ADDRESS" = ? AND "BATCH_ID" = ? AND "${field}" IN (${placeholders})`,
    [email, lastBatchId, ...value],
  );
  const matched = Number(rows.rows[0]?.CNT ?? 0) > 0;
  return op === 'not_in' ? (matched ? 'no' : 'yes') : (matched ? 'yes' : 'no');
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
  const recipient: RecipientRow = enrollment.METADATA
    ? (JSON.parse(enrollment.METADATA) as RecipientRow)
    : { EMAIL_ADDRESS: enrollment.EMAIL_ADDRESS, FIRST_NAME: '', LAST_NAME: '', CATEGORY: '', COMPANY: '', PHONE_NUMBER: '', COMMENTS: '' };

  const now = new Date();
  let nextRunAt: Date | null = null;
  let completed = false;
  const sentBatchIds: string[] = [];

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
      const { days = 0, date } = currentNode.data;
      nextRunAt = date ? new Date(date) : addDays(now, days);
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
        sentBatchIds.push(batchId);
      }
      // Stop after sending — next node (often a condition) needs async events first
      currentNode = nextNode(flow, currentNode.id) ?? undefined!;
      break;
    }

    // Unknown node type — skip
    currentNode = nextNode(flow, currentNode.id) ?? undefined!;
  }

  if (!currentNode) completed = true;

  if (completed) {
    await query(
      `UPDATE "HATCH"."SEQUENCE_ENROLLMENTS"
          SET STATUS = 'completed', UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ?`,
      [enrollment.ID],
    );
    return 'completed';
  }

  const scheduleAt = nextRunAt ?? now;
  await query(
    `UPDATE "HATCH"."SEQUENCE_ENROLLMENTS"
        SET CURRENT_NODE = ?, LAST_BATCH_ID = COALESCE(?, LAST_BATCH_ID),
            NEXT_RUN_AT = ?, UPDATED_AT = CURRENT_TIMESTAMP
      WHERE ID = ?`,
    [currentNode?.id ?? enrollment.CURRENT_NODE, lastBatchId, scheduleAt.toISOString(), enrollment.ID],
  );
  return nextRunAt ? 'waiting' : 'waiting';
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
