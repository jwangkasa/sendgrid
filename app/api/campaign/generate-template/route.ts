import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { assertSameOrigin } from '@/lib/cors';

interface GenerateTemplateRequest {
  description: string;
}

export interface GeneratedSection {
  type: 'heading' | 'body' | 'cta';
  content: string;
  href?: string;
}

export interface GenerateTemplateResponse {
  sections: GeneratedSection[];
}

const SYSTEM_PROMPT = `You are an expert email copywriter. Given a topic or description, generate structured email content.
Respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. Use exactly this structure:
{
  "sections": [
    { "type": "heading", "content": "<headline text>" },
    { "type": "body",    "content": "<paragraph text>" },
    { "type": "body",    "content": "<paragraph text>" },
    { "type": "cta",     "content": "<button label>", "href": "#" }
  ]
}

Rules:
- "heading" sections are short, punchy headlines (max 12 words)
- "body" sections are 2-4 sentences of professional B2B email copy
- "cta" sections are action-oriented button labels (max 5 words), always include href "#" as a placeholder
- Include 1 heading, 2-3 body sections, and 1 cta
- Use {{FIRST_NAME}} personalisation token in the first body section where natural
- Professional B2B tone`;

function getCredentials() {
  const baseUrl       = process.env.AICORE_BASE_URL;
  const authUrl       = process.env.AICORE_AUTH_URL;
  const clientId      = process.env.AICORE_CLIENT_ID;
  const clientSecret  = process.env.AICORE_CLIENT_SECRET;
  const deploymentId  = process.env.AICORE_DEPLOYMENT_ID;
  const resourceGroup = process.env.AICORE_RESOURCE_GROUP ?? 'default';

  const missing = ['AICORE_BASE_URL','AICORE_AUTH_URL','AICORE_CLIENT_ID','AICORE_CLIENT_SECRET','AICORE_DEPLOYMENT_ID']
    .filter(k => !process.env[k]);
  if (missing.length > 0) throw new Error(`Missing SAP AI Core env vars: ${missing.join(', ')}`);

  return { baseUrl: baseUrl!, authUrl: authUrl!, clientId: clientId!, clientSecret: clientSecret!, deploymentId: deploymentId!, resourceGroup };
}

async function fetchBearerToken(authUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:  `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI Core OAuth2 token fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error('AI Core OAuth2 response missing access_token');
  return json.access_token;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corsBlock = assertSameOrigin(req);
  if (corsBlock) return corsBlock as NextResponse;

  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ message: err.message }, { status: err.statusCode });
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  let body: GenerateTemplateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { description } = body;
  if (!description || typeof description !== 'string' || description.trim().length < 3) {
    return NextResponse.json({ message: 'description must be at least 3 characters' }, { status: 400 });
  }
  if (description.length > 500) {
    return NextResponse.json({ message: 'description must be under 500 characters' }, { status: 400 });
  }

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
    return NextResponse.json({ message: `AI Core auth failed: ${(err as Error).message}` }, { status: 502 });
  }

  const apiBase = creds.baseUrl.replace(/\/v2\/?$/, '').replace(/\/$/, '');
  const chatUrl = `${apiBase}/v2/inference/deployments/${creds.deploymentId}/completion`;

  let aiRes: globalThis.Response;
  try {
    aiRes = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        Authorization:       `Bearer ${bearerToken}`,
        'ai-resource-group': creds.resourceGroup,
      },
      body: JSON.stringify({
        orchestration_config: {
          module_configurations: {
            templating_module_config: {
              template: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: `Generate a professional B2B email for: ${description.trim()}` },
              ],
            },
            llm_module_config: {
              model_name:   'gpt-4o-mini',
              model_params: { max_tokens: 800, temperature: 0.6 },
            },
          },
        },
        input_params: {},
      }),
    });
  } catch (err) {
    return NextResponse.json({ message: `AI Core network error: ${(err as Error).message}` }, { status: 502 });
  }

  if (!aiRes.ok) {
    const text = await aiRes.text().catch(() => '');
    return NextResponse.json({ message: `AI Core returned ${aiRes.status}: ${text.slice(0, 200)}` }, { status: 502 });
  }

  interface OrchestrationResult {
    orchestration_result?: { choices?: { message: { content: string } }[] };
  }
  const completion = await aiRes.json() as OrchestrationResult;
  const aiText = completion.orchestration_result?.choices?.[0]?.message?.content ?? '';

  let parsed: GenerateTemplateResponse;
  try {
    const clean = aiText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(clean) as GenerateTemplateResponse;
    if (!Array.isArray(parsed.sections)) throw new Error('Invalid response shape');
  } catch {
    return NextResponse.json({ message: 'AI returned unexpected format. Please try again.' }, { status: 502 });
  }

  return NextResponse.json(parsed);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 405 });
}
