import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { assertSameOrigin } from '@/lib/cors';
import { query } from '@/lib/db';
import type { RecipientLog, RecipientRow } from '@/lib/types';

interface AnalyseRequestBody {
  batchIds: string[];
}

// ── SAP AI Core credentials ───────────────────────────────────────────────────

function getCredentials() {
  const baseUrl       = process.env.AICORE_BASE_URL;
  const authUrl       = process.env.AICORE_AUTH_URL;
  const clientId      = process.env.AICORE_CLIENT_ID;
  const clientSecret  = process.env.AICORE_CLIENT_SECRET;
  const deploymentId  = process.env.AICORE_DEPLOYMENT_ID;
  const resourceGroup = process.env.AICORE_RESOURCE_GROUP ?? 'default';

  const missing = ['AICORE_BASE_URL','AICORE_AUTH_URL','AICORE_CLIENT_ID','AICORE_CLIENT_SECRET','AICORE_DEPLOYMENT_ID']
    .filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing SAP AI Core env vars: ${missing.join(', ')}`);
  }

  return { baseUrl: baseUrl!, authUrl: authUrl!, clientId: clientId!, clientSecret: clientSecret!, deploymentId: deploymentId!, resourceGroup };
}

// ── Fetch OAuth2 bearer token via client_credentials grant ───────────────────

async function fetchBearerToken(authUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'client_credentials' });

  const res = await fetch(authUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      Authorization:   `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI Core OAuth2 token fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error('AI Core OAuth2 response missing access_token');
  return json.access_token;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  const total     = rows.length;
  const openRate  = total > 0 ? ((engaged.length / total) * 100).toFixed(1) : '0';
  const failRate  = total > 0 ? ((failed.length  / total) * 100).toFixed(1) : '0';

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

  // ── 7. Fetch OAuth2 token + call SAP AI Core directly ────────────────────────
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

  let creds: ReturnType<typeof getCredentials>;
  try {
    creds = getCredentials();
  } catch (err) {
    return NextResponse.json({ message: (err as Error).message }, { status: 500 });
  }

  let bearerToken: string;
  try {
    bearerToken = await fetchBearerToken(creds.authUrl, creds.clientId, creds.clientSecret);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[analyse] OAuth2 token error:', detail);
    return NextResponse.json({ message: `AI Core auth failed: ${detail}` }, { status: 502 });
  }

  // Build the chat completions URL:
  // baseUrl already contains /v2, SDK appends /inference/deployments/{id}/chat/completions
  const chatUrl = `${creds.baseUrl.replace(/\/$/, '')}/inference/deployments/${creds.deploymentId}/chat/completions`;

  let aiRes: globalThis.Response;
  try {
    aiRes = await fetch(chatUrl, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        Authorization:       `Bearer ${bearerToken}`,
        'ai-resource-group': creds.resourceGroup,
      },
      body: JSON.stringify({
        messages:    [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        max_tokens:  2000,
        temperature: 0.4,
        stream:      false,
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[analyse] AI Core fetch error:', detail);
    return NextResponse.json({ message: `AI Core network error: ${detail}` }, { status: 502 });
  }

  if (!aiRes.ok) {
    const text = await aiRes.text().catch(() => '');
    console.error('[analyse] AI Core non-OK response:', aiRes.status, text.slice(0, 500));
    return NextResponse.json(
      { message: `AI Core returned ${aiRes.status}: ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }

  interface ChatCompletion {
    choices: { message: { content: string } }[];
  }
  const completion = await aiRes.json() as ChatCompletion;
  const aiText = completion.choices?.[0]?.message?.content ?? '';

  // ── 8. Return JSON text + recipients as a single response ─────────────────────
  const SEPARATOR = '\n\n__RECIPIENTS__\n';
  const responseBody = aiText + SEPARATOR + JSON.stringify(segmentRecipients);

  return new Response(responseBody, {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 405 });
}
