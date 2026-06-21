/**
 * lib/sendgrid.ts
 *
 * SendGrid v3 API client wrapper.
 *
 * Surfaces two functions consumed by the dispatch route:
 *   sendPersonalizedBatch()  — sends one pre-built chunk (≤ 1,000 personalizations)
 *   sendTestEmail()          — single-recipient convenience wrapper
 *
 * The caller is responsible for chunking. Both functions throw on non-2xx
 * responses so the dispatch route can abort its transaction.
 */

import type { RecipientRow, EmailTemplate } from '@/lib/types';

// ─── Initialisation ───────────────────────────────────────────────────────────

function getSendGridApiKey(): string {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('Missing SENDGRID_API_KEY environment variable');
  return apiKey;
}

async function sendRaw(payload: unknown): Promise<number> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getSendGridApiKey()}`,
    },
    body: JSON.stringify(payload),
  });
  return res.status;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Personalization {
  to:      { email: string; name?: string }[];
  subject?: string;
  dynamic_template_data?: Record<string, string>;
}

export interface BatchSendResult {
  /** HTTP status code returned by SendGrid (202 = accepted) */
  statusCode: number;
  /** Number of personalizations submitted in this chunk */
  count: number;
}

// ─── Token interpolation ──────────────────────────────────────────────────────

const TOKEN_REGEX = /\{\{([A-Z_]+)\}\}/g;

function interpolate(template: string, row: RecipientRow): string {
  return template.replace(TOKEN_REGEX, (_, name: string) => {
    const val = row[name as keyof RecipientRow];
    return val !== undefined && val !== '' ? String(val) : '';
  });
}

// ─── Build a Personalization object for one recipient ─────────────────────────

export function buildPersonalization(
  recipient: RecipientRow,
  batchId: string,
  subjectTemplate: string,
): Personalization {
  const displayName = [recipient.FIRST_NAME, recipient.LAST_NAME]
    .filter(Boolean)
    .join(' ')
    .trim() || recipient.EMAIL_ADDRESS;

  return {
    to: [{ email: recipient.EMAIL_ADDRESS, name: displayName }],
    subject: interpolate(subjectTemplate, recipient),
  };
}

// ─── Send a chunk of up to 1,000 personalizations ────────────────────────────
//
// SendGrid's /v3/mail/send Personalizations array accepts up to 1,000 entries
// in a single HTTP call. The dispatch route chunks the recipient list and calls
// this function once per chunk so we never exceed that ceiling.
//
// The HTML and plain-text bodies are set at the message level (not per-
// personalization) because they share the same template; individual subject
// lines and custom_args are carried per-personalization.

export async function sendPersonalizedBatch(
  recipients: RecipientRow[],
  template: EmailTemplate,
  batchId: string
): Promise<BatchSendResult> {
  if (recipients.length === 0) return { statusCode: 202, count: 0 };
  if (recipients.length > 1000) {
    throw new Error(
      `sendPersonalizedBatch received ${recipients.length} recipients — max is 1,000. ` +
      'The caller must chunk before invoking this function.'
    );
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName  = process.env.SENDGRID_FROM_NAME ?? '';
  if (!fromEmail) throw new Error('Missing SENDGRID_FROM_EMAIL environment variable');

  // Interpolate body per recipient server-side — SendGrid's substitutions map
  // is unreliable with the v3 non-template API, so we resolve tokens here and
  // send one API call per recipient.
  const results = await Promise.all(
    recipients.map(async (r) => {
      const htmlBody = interpolate(template.htmlBody, r);
      const textBody = interpolate(template.textBody, r);

      const rawContent = (() => {
          if (htmlBody.trim() && textBody.trim()) {
            return [{ type: 'text/html', value: htmlBody }, { type: 'text/plain', value: textBody }];
          }
          if (htmlBody.trim()) return [{ type: 'text/html',  value: htmlBody }];
          if (textBody.trim()) return [{ type: 'text/plain', value: textBody }];
          return [{ type: 'text/plain', value: ' ' }];
        })();

      const message = {
        from: { email: fromEmail, name: fromName },
        personalizations: [buildPersonalization(r, batchId, template.subject)],
        content: rawContent,
        // Use snake_case key directly — the SDK excludes 'customArgs' from its
        // toSnakeCase conversion, so camelCase is silently dropped by the API.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        custom_args: {
          batch_id: batchId,
          email:    r.EMAIL_ADDRESS,
        },
        trackingSettings: {
          clickTracking: { enable: true, enableText: false },
          openTracking:  { enable: true },
        },
      };

      const statusCode = await sendRaw(message);
      return statusCode;
    })
  );

  return {
    statusCode: results.every((s) => s >= 200 && s < 300) ? 202 : 500,
    count:      recipients.length,
  };
}

// ─── Convenience: single-recipient test send ──────────────────────────────────

export async function sendTestEmail(
  recipient: RecipientRow,
  template: EmailTemplate,
  batchId: string
): Promise<BatchSendResult> {
  return sendPersonalizedBatch([recipient], template, batchId);
}
