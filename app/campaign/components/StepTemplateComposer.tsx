'use client';

import { useState, useCallback, useEffect } from 'react';
import type { EmailTemplate } from '@/lib/types';
import type { SenderOption } from '@/app/api/campaign/senders/route';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  CheckIcon,
  InfoIcon,
  UserIcon,
} from 'lucide-react';

// Token catalogue — maps to HANA column names used in interpolation
const TOKENS: { token: string; description: string; example: string }[] = [
  { token: '{{FIRST_NAME}}',    description: 'First name',       example: 'Jane'             },
  { token: '{{LAST_NAME}}',     description: 'Last name',        example: 'Doe'              },
  { token: '{{COMPANY}}',       description: 'Company name',     example: 'Acme Corp'        },
  { token: '{{CATEGORY}}',      description: 'Recipient category', example: 'Enterprise'     },
  { token: '{{COMMENTS}}',      description: 'Custom comments',  example: 'VIP renewal 2026' },
  { token: '{{EMAIL_ADDRESS}}', description: 'Email address',    example: 'jane@acme.com'    },
  { token: '{{PHONE_NUMBER}}',  description: 'Phone number',     example: '+1 555 000 0000'  },
];

// Regex to find any {{TOKEN}} pattern in a string
const TOKEN_REGEX = /\{\{([A-Z_]+)\}\}/g;
const VALID_TOKEN_NAMES = new Set(TOKENS.map((t) => t.token.slice(2, -2)));

function detectUnknownTokens(text: string): string[] {
  const unknown: string[] = [];
  for (const match of text.matchAll(TOKEN_REGEX)) {
    if (!VALID_TOKEN_NAMES.has(match[1]!)) unknown.push(`{{${match[1]}}}`);
  }
  return [...new Set(unknown)];
}

function countTokenUsage(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const match of text.matchAll(TOKEN_REGEX)) {
    const name = match[1]!;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

interface TokenChipProps {
  token: string;
  onClick: (token: string) => void;
  usedIn?: string;
}

function TokenChip({ token, onClick, usedIn }: TokenChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                    bg-gray-50 border border-gray-200 hover:border-gray-300
                    transition-colors group">
      <button
        onClick={() => onClick(token)}
        className="flex items-center gap-2 text-left min-w-0"
        title="Click to insert token"
      >
        <span className="font-mono text-xs text-brand-600 truncate flex-shrink-0">{token}</span>
        {usedIn && (
          <span className="text-[10px] text-brand-500 font-medium shrink-0">✓ used</span>
        )}
      </button>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
        title="Copy to clipboard"
      >
        {copied
          ? <CheckIcon className="w-3 h-3 text-emerald-500" />
          : <ClipboardCopyIcon className="w-3 h-3" />
        }
      </button>
    </div>
  );
}

interface StepTemplateComposerProps {
  initialTemplate: EmailTemplate;
  recipientCount: number;
  idToken: string | null;
  onComplete: (template: EmailTemplate) => void;
  onBack: () => void;
}

export function StepTemplateComposer({
  initialTemplate,
  recipientCount,
  idToken,
  onComplete,
  onBack,
}: StepTemplateComposerProps) {
  const [subject,   setSubject]   = useState(initialTemplate.subject);
  const [htmlBody,  setHtmlBody]  = useState(initialTemplate.htmlBody);
  const [textBody,  setTextBody]  = useState(initialTemplate.textBody);
  const [fromEmail, setFromEmail] = useState(initialTemplate.fromEmail);
  const [fromName,  setFromName]  = useState(initialTemplate.fromName);
  const [activeTab, setActiveTab] = useState<'html' | 'text'>('html');

  const [senders,       setSenders]       = useState<SenderOption[]>([]);
  const [sendersLoading, setSendersLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    fetch('/api/campaign/senders', {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((r) => r.json())
      .then((data: { senders: SenderOption[] }) => {
        setSenders(data.senders ?? []);
        // Auto-select first sender if none chosen yet
        if (!fromEmail && data.senders?.[0]) {
          setFromEmail(data.senders[0].email);
          setFromName(data.senders[0].name ?? '');
        }
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setSendersLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  // Derived analysis
  const activeBody       = activeTab === 'html' ? htmlBody : textBody;
  const combinedText     = `${subject} ${htmlBody} ${textBody}`;
  const unknownTokens    = detectUnknownTokens(combinedText);
  const subjectUsage     = countTokenUsage(subject);
  const htmlUsage        = countTokenUsage(htmlBody);
  const textUsage        = countTokenUsage(textBody);
  const allUsage         = countTokenUsage(combinedText);

  // Insert token at cursor — falls back to append
  const insertToken = useCallback(
    (token: string) => {
      if (activeTab === 'html') {
        setHtmlBody((prev) => prev + token);
      } else {
        setTextBody((prev) => prev + token);
      }
    },
    [activeTab]
  );

  const canProceed =
    subject.trim().length > 0 &&
    (htmlBody.trim().length > 0 || textBody.trim().length > 0) &&
    unknownTokens.length === 0 &&
    fromEmail.trim().length > 0;

  const handleContinue = () => {
    if (canProceed) {
      onComplete({ subject, htmlBody, textBody, fromEmail, fromName });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left — editor column */}
        <div className="panel p-6 flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Email Template</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Compose your message. Insert tokens from the panel on the right — they'll be
              substituted per recipient at dispatch time.
            </p>
          </div>

          {/* Sender */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="w-3 h-3" />
              Send From
            </label>
            {sendersLoading ? (
              <div className="h-10 rounded-lg bg-gray-100 animate-pulse w-full" />
            ) : senders.length === 0 ? (
              <p className="text-xs text-red-500">
                No verified senders found. Set <code className="font-mono bg-red-50 px-1 rounded">SENDGRID_VERIFIED_SENDERS</code> in your environment.
              </p>
            ) : (
              <select
                value={fromEmail}
                onChange={(e) => {
                  const picked = senders.find((s) => s.email === e.target.value);
                  setFromEmail(e.target.value);
                  setFromName(picked?.name ?? '');
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300
                           text-sm text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                           transition-colors"
              >
                {senders.map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.name ? `${s.name} <${s.email}>` : s.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject line */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                Subject Line
              </label>
              <span className="text-[11px] text-gray-400">{subject.length} chars</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Hi {{FIRST_NAME}}, your {{CATEGORY}} update is here"
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300
                           text-sm text-gray-900 placeholder-gray-400 font-mono
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                           transition-colors"
              />
            </div>
            {/* Highlight tokens used in subject */}
            {Object.keys(subjectUsage).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {Object.keys(subjectUsage).map((name) => (
                  <span key={name} className="token-chip">
                    {`{{${name}}}`}
                    <span className="text-brand-500">×{subjectUsage[name]}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Body editor tabs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                {(['html', 'text'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'html' ? 'HTML Body' : 'Plain Text Body'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-gray-400">{activeBody.length} chars</span>
            </div>

            <textarea
              value={activeBody}
              onChange={(e) =>
                activeTab === 'html'
                  ? setHtmlBody(e.target.value)
                  : setTextBody(e.target.value)
              }
              placeholder={
                activeTab === 'html'
                  ? '<p>Hello {{FIRST_NAME}},</p>\n<p>We have exciting news for {{COMPANY}}…</p>'
                  : 'Hello {{FIRST_NAME}},\n\nWe have exciting news for {{COMPANY}}…'
              }
              rows={16}
              spellCheck={false}
              className="w-full px-3 py-3 rounded-lg bg-white border border-gray-300
                         text-sm text-gray-800 placeholder-gray-400 font-mono leading-relaxed
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                         transition-colors resize-y min-h-[280px]"
            />

            {/* Token highlights for active body */}
            {Object.keys(activeTab === 'html' ? htmlUsage : textUsage).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.keys(activeTab === 'html' ? htmlUsage : textUsage).map((name) => (
                  <span key={name} className="token-chip">
                    {`{{${name}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Unknown token warning */}
          {unknownTokens.length > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200">
              <InfoIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-700">Unrecognised tokens detected</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  These tokens won't be substituted at dispatch:{' '}
                  <span className="font-mono">{unknownTokens.join(', ')}</span>
                </p>
              </div>
            </div>
          )}

          {/* Recipient count indicator */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <div className="w-2 h-2 rounded-full bg-brand-500" />
            <p className="text-xs text-gray-500">
              This template will be personalised for{' '}
              <span className="font-semibold text-gray-900">{recipientCount.toLocaleString()}</span>{' '}
              recipients.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg
                         text-gray-500 hover:text-gray-900 text-sm
                         border border-gray-300 hover:border-gray-400
                         transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!canProceed}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                         bg-brand-600 hover:bg-brand-500 disabled:bg-gray-200 disabled:text-gray-400
                         text-white text-sm font-medium
                         transition-colors duration-150 shadow-sm
                         disabled:cursor-not-allowed disabled:shadow-none"
            >
              Preview & Dispatch
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right — token reference panel */}
        <div className="flex flex-col gap-4">
          <div className="panel p-5 flex flex-col gap-4 sticky top-20">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Substitution Tokens</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Click a token to insert it at the end of the active editor, or copy it.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              {TOKENS.map(({ token, description, example }) => (
                <div key={token}>
                  <TokenChip
                    token={token}
                    onClick={insertToken}
                    usedIn={allUsage[token.slice(2, -2)] ? 'used' : undefined}
                  />
                  <p className="text-[10px] text-gray-400 px-1 mt-0.5">
                    {description} — e.g. <em className="text-gray-500">{example}</em>
                  </p>
                </div>
              ))}
            </div>

            {/* Usage summary */}
            {Object.keys(allUsage).length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[11px] font-medium text-gray-500 mb-2">Token usage summary</p>
                <div className="flex flex-col gap-1">
                  {Object.entries(allUsage).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-brand-600">{`{{${name}}}`}</span>
                      <span className="text-[11px] text-gray-400">{count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
