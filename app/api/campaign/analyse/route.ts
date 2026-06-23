import { NextRequest, NextResponse } from 'next/server';
import { AzureOpenAiChatClient } from '@sap-ai-sdk/foundation-models';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { assertSameOrigin } from '@/lib/cors';
import { query } from '@/lib/db';
import type { RecipientLog, RecipientRow } from '@/lib/types';

interface AnalyseRequestBody {
  batchIds: string[];
}

function getAiCoreDestination() {
  const url             = process.env.AICORE_BASE_URL;
  const tokenServiceUrl = process.env.AICORE_AUTH_URL;
  const clientId        = process.env.AICORE_CLIENT_ID;
  const clientSecret    = process.env.AICORE_CLIENT_SECRET;

  if (!url || !tokenServiceUrl || !clientId || !clientSecret) {
    const missing = ['AICORE_BASE_URL','AICORE_AUTH_URL','AICORE_CLIENT_ID','AICORE_CLIENT_SECRET']
      .filter(k => !process.env[k]);
    throw new Error(`Missing SAP AI Core credentials: ${missing.join(', ')}`);
  }

  // Log credential shape (never log actual values) to help diagnose truncation issues
  console.log('[analyse] AI Core credentials check — clientId length:', clientId.length,
    '| clientSecret length:', clientSecret.length,
    '| url:', url);

  return {
    url,
    authentication: 'OAuth2ClientCredentials' as const,
    tokenServiceUrl,
    clientId,
    clientSecret,
  };
}
export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  // ── 1. CORS guard ────────────────────────────────────────────────────────────
  const corsBlock = assertSameOrigin(req);
  if (corsBlock) return corsBlock;

  // ── 2. Auth ──────────────────────────────────────────────────────────────────
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  // ── 3. Validate body ─────────────────────────────────────────────────────────
  let body: AnalyseRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { batchIds } = body;
  if (!Array.isArray(batchIds) || batchIds.length === 0) {
    return NextResponse.json({ message: 'batchIds must be a non-empty array' }, { status: 400 });
  }
  if (batchIds.some((id) => typeof id !== 'string' || id.length > 50)) {
    return NextResponse.json({ message: 'Invalid batchId value' }, { status: 400 });
  }

  // ── 4. Fetch recipients from HANA ────────────────────────────────────────────
  const placeholders = batchIds.map(() => '?').join(', ');
  let rows: RecipientLog[];
  try {
    const result = await query<RecipientLog>(
      `SELECT
         "FIRST_NAME", "LAST_NAME", "EMAIL_ADDRESS", "CATEGORY", "COMPANY",
         "CAMPAIGN_NAME", "DELIVERY_STATUS", "OPEN_COUNT", "CLICK_COUNT", "FAILURE_REASON"
       FROM RECIPIENT_LOGS
       WHERE "BATCH_ID" IN (${placeholders})`,
      batchIds
    );
    rows = result.rows;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[analyse] HANA query error:', err);
    return NextResponse.json({ message: `Database error: ${detail}` }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ message: 'No recipients found for the selected campaigns' }, { status: 404 });
  }

  // ── 5. Server-side segmentation ──────────────────────────────────────────────
  const engaged:      RecipientLog[] = [];
  const unresponsive: RecipientLog[] = [];
  const failed:       RecipientLog[] = [];

  for (const r of rows) {
    const status = r.DELIVERY_STATUS;
    if (r.OPEN_COUNT > 0 || r.CLICK_COUNT > 0 || status === 'Opened' || status === 'Clicked') {
      engaged.push(r);
    } else if (status === 'Bounced' || status === 'Dropped' || status === 'Failed') {
      failed.push(r);
    } else {
      unresponsive.push(r);
    }
  }

  const total      = rows.length;
  const openRate   = total > 0 ? ((engaged.length / total) * 100).toFixed(1) : '0';
  const failRate   = total > 0 ? ((failed.length  / total) * 100).toFixed(1) : '0';

  const campaignNames = [...new Set(rows.map((r) => r.CAMPAIGN_NAME).filter(Boolean))].join(', ') || 'Unknown Campaign';

  const sample = (list: RecipientLog[]) =>
    list
      .slice(0, 5)
      .map((r) => `${[r.FIRST_NAME, r.LAST_NAME].filter(Boolean).join(' ') || r.EMAIL_ADDRESS}${r.COMPANY ? ` (${r.COMPANY})` : ''}`)
      .join(', ');

  // ── 6. Build recipients arrays per segment (for sessionStorage pre-fill) ─────
  const toRecipientRow = (r: RecipientLog): RecipientRow => ({
    FIRST_NAME:    r.FIRST_NAME    ?? '',
    LAST_NAME:     r.LAST_NAME     ?? '',
    EMAIL_ADDRESS: r.EMAIL_ADDRESS,
    CATEGORY:      r.CATEGORY      ?? '',
    COMPANY:       r.COMPANY       ?? '',
    PHONE_NUMBER:  '',
    COMMENTS:      '',
  });

  const segmentRecipients = {
    engaged:      engaged.map(toRecipientRow),
    unresponsive: unresponsive.map(toRecipientRow),
    failed:       failed.map(toRecipientRow),
  };

  // ── 7. Call SAP AI Core (streaming) ──────────────────────────────────────────
  const systemPrompt = `You are a B2B email marketing analyst. Analyse the campaign data provided and respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. Use exactly this structure:
{
  "summary": "<2 paragraphs of plain-English campaign performance narrative>",
  "segments": {
    "engaged":      { "count": <number>, "subject": "<follow-up email subject>", "body": "<HTML email body>" },
    "unresponsive": { "count": <number>, "subject": "<re-engagement email subject>", "body": "<HTML email body>" },
    "failed":       { "count": <number>, "subject": "<bounce handling subject>",  "body": "<HTML email body>" }
  }
}
Rules:
- All email bodies must be valid HTML using only <p>, <strong>, <a>, <br> tags
- Use {{FIRST_NAME}} and {{COMPANY}} tokens for personalisation where natural
- The tone should be professional B2B
- Do not include unsubscribe footers or legal text`;

  const userMessage = `Campaign: ${campaignNames}
Total recipients: ${total}
Engaged (opened or clicked): ${engaged.length} (${openRate}%)
Unresponsive (delivered, no open): ${unresponsive.length}
Failed (bounced/dropped): ${failed.length} (${failRate}%)

Sample engaged recipients: ${sample(engaged) || 'none'}
Sample unresponsive recipients: ${sample(unresponsive) || 'none'}
Sample failed recipients: ${sample(failed) || 'none'}

Generate the campaign summary and one follow-up email draft per segment. Set the "count" fields to exactly: engaged=${engaged.length}, unresponsive=${unresponsive.length}, failed=${failed.length}.`;

  let aiStream: AsyncIterable<string>;
  try {
    const destination    = getAiCoreDestination();
    const deploymentId   = process.env.AICORE_DEPLOYMENT_ID;
    const resourceGroup  = process.env.AICORE_RESOURCE_GROUP ?? 'default';

    if (!deploymentId) {
      return NextResponse.json({ message: 'AICORE_DEPLOYMENT_ID is not configured' }, { status: 500 });
    }

    const client = new AzureOpenAiChatClient(
      { deploymentId, resourceGroup },
      destination,
    );
    const result = await client.stream({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        max_tokens:  2000,
        temperature: 0.4,
      });
    aiStream = result.stream.toContentStream();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // Log the full error including cause chain so Vercel logs show the real reason
    const cause  = (err as { cause?: unknown })?.cause;
    const causeDetail = cause instanceof Error ? cause.message : cause ? String(cause) : null;
    console.error('[analyse] SAP AI Core error:', detail, causeDetail ? `| cause: ${causeDetail}` : '', err);
    return NextResponse.json(
      { message: `AI service error: ${detail}${causeDetail ? ` — ${causeDetail}` : ''}` },
      { status: 502 }
    );
  }

  // ── 8. Stream response — JSON text + recipients appended as a trailer ─────────
  // We stream the AI JSON text first, then append a sentinel + serialised
  // recipient arrays so the client can build the "Launch" payload without a
  // second round-trip.
  const encoder = new TextEncoder();
  const SEPARATOR = '\n\n__RECIPIENTS__\n';

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of aiStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        // Append recipient data after the AI JSON
        controller.enqueue(encoder.encode(SEPARATOR + JSON.stringify(segmentRecipients)));
      } catch (err) {
        console.error('[analyse] stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 405 });
}
