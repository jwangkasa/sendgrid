'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { EmailTemplate, RecipientRow } from '@/lib/types';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronLeftIcon as PrevIcon,
  SendIcon,
  MonitorIcon,
  FileTextIcon,
  RocketIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderIcon,
} from 'lucide-react';

// ─── Token interpolation engine ───────────────────────────────────────────────

const TOKEN_REGEX = /\{\{([A-Z_]+)\}\}/g;

function interpolate(template: string, row: RecipientRow): string {
  return template.replace(TOKEN_REGEX, (_, name: string) => {
    const val = row[name];
    return val !== undefined && val !== '' ? val : '';
  });
}

function missingTokens(template: string, row: RecipientRow): string[] {
  const missing: string[] = [];
  for (const [, name] of template.matchAll(new RegExp(TOKEN_REGEX.source, 'g'))) {
    if (name && (row[name] === undefined || row[name] === '') && !missing.includes(name)) {
      missing.push(name);
    }
  }
  return missing;
}

// ─── Sandboxed preview iframe ─────────────────────────────────────────────────

interface HtmlPreviewProps {
  html: string;
}

function HtmlPreview({ html }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 16px; font-family: sans-serif; font-size: 14px;
         color: #1a1a1a; background: #ffffff; line-height: 1.6; }
  a { color: #0284c7; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>${html}</body>
</html>`);
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Email HTML preview"
      sandbox="allow-same-origin allow-scripts"
      className="w-full rounded-b-lg bg-white"
      style={{ height: '480px', border: 'none' }}
    />
  );
}

// ─── Send Test Copy modal state ───────────────────────────────────────────────

interface TestSendState {
  status: 'idle' | 'sending' | 'sent' | 'error';
  message: string;
}

interface StepPreviewProps {
  recipients:    RecipientRow[];
  template:      EmailTemplate;
  fileName:      string | null;
  campaignName:  string;
  idToken:       string | null;
  dispatching:   boolean;
  dispatchError: string | null;
  onDispatch:    (batchId: string) => Promise<void>;
  onBack:        () => void;
}

export function StepPreview({
  recipients,
  template,
  fileName,
  campaignName,
  idToken,
  dispatching,
  dispatchError,
  onDispatch,
  onBack,
}: StepPreviewProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [activeTab, setActiveTab]       = useState<'html' | 'text' | 'subject'>('html');
  const [testEmail, setTestEmail]       = useState('');
  const [testState, setTestState]       = useState<TestSendState>({ status: 'idle', message: '' });
  const [batchId]                       = useState(() => uuidv4().replace(/-/g, '').slice(0, 24).toUpperCase());
  const [confirmVisible, setConfirmVisible] = useState(false);

  const totalRows    = recipients.length;
  const currentRow   = recipients[previewIndex] ?? recipients[0];

  // Interpolated values
  const previewSubject  = useMemo(() => interpolate(template.subject,  currentRow ?? {}  as RecipientRow), [template.subject,  currentRow]);
  const previewHtml     = useMemo(() => interpolate(template.htmlBody, currentRow ?? {} as RecipientRow), [template.htmlBody, currentRow]);
  const previewText     = useMemo(() => interpolate(template.textBody, currentRow ?? {} as RecipientRow), [template.textBody, currentRow]);

  const activeContent = activeTab === 'html' ? previewHtml : activeTab === 'text' ? previewText : previewSubject;

  // Warn if any tokens in the template have no matching column in the data
  const unmatchedTokens = useMemo(() => {
    if (!currentRow) return [];
    const allTemplates = `${template.subject}\n${template.htmlBody}\n${template.textBody}`;
    return missingTokens(allTemplates, currentRow);
  }, [template, currentRow]);

  const navigateRow = (dir: 'prev' | 'next') => {
    setPreviewIndex((i) =>
      dir === 'prev' ? Math.max(0, i - 1) : Math.min(totalRows - 1, i + 1)
    );
  };

  // ── Send test copy ──────────────────────────────────────────────────────────
  const handleTestSend = useCallback(async () => {
    if (!testEmail.includes('@')) return;
    if (!idToken) return;

    setTestState({ status: 'sending', message: '' });
    try {
      const testRecipient: RecipientRow = {
        ...(currentRow ?? {} as RecipientRow),
        EMAIL_ADDRESS: testEmail,
      };
      const res = await fetch('/api/campaign/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipients: [testRecipient],
          template,
          batchId: `TEST_${batchId}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? 'Test send failed');
      }
      setTestState({ status: 'sent', message: `Test copy sent to ${testEmail}` });
    } catch (err) {
      setTestState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [testEmail, idToken, currentRow, template, batchId]);

  // ── Dispatch ────────────────────────────────────────────────────────────────
  const handleConfirmDispatch = async () => {
    setConfirmVisible(false);
    await onDispatch(batchId);
  };

  if (!currentRow) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Campaign summary card */}
      <div className="panel p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-900">
            {campaignName || <span className="text-gray-400 italic">Unnamed Campaign</span>}
          </h2>
          <p className="text-sm text-gray-500">
            Review how each recipient will see their personalised email.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-gray-900">{totalRows.toLocaleString()}</span>
            <span className="text-[11px] text-gray-400 uppercase tracking-wide">Recipients</span>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="flex flex-col items-center">
            <span className="text-xs font-mono text-brand-600 font-semibold">{batchId}</span>
            <span className="text-[11px] text-gray-400 uppercase tracking-wide">Batch ID</span>
          </div>
          {fileName && (
            <>
              <div className="w-px h-8 bg-gray-200 hidden sm:block" />
              <div className="flex flex-col items-center hidden sm:flex">
                <span className="text-xs text-gray-700 font-medium max-w-[120px] truncate">{fileName}</span>
                <span className="text-[11px] text-gray-400 uppercase tracking-wide">Source File</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row navigator + preview */}
      <div className="panel overflow-hidden">
        {/* Navigator bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Previewing recipient</span>
            <span className="text-xs font-semibold text-gray-900">
              {previewIndex + 1} <span className="text-gray-400">of {totalRows.toLocaleString()}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateRow('prev')}
              disabled={previewIndex === 0}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100
                         disabled:opacity-30 disabled:cursor-default transition-colors"
              aria-label="Previous recipient"
            >
              <PrevIcon className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={totalRows}
              value={previewIndex + 1}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= totalRows) setPreviewIndex(v - 1);
              }}
              className="w-14 text-center px-1 py-1 text-xs rounded bg-white border
                         border-gray-300 text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Go to recipient index"
            />
            <button
              onClick={() => navigateRow('next')}
              disabled={previewIndex === totalRows - 1}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100
                         disabled:opacity-30 disabled:cursor-default transition-colors"
              aria-label="Next recipient"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recipient context pill */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-white border-b border-gray-100 text-xs">
          <span className="text-gray-400">To:</span>
          <span className="font-medium text-gray-900">{currentRow.FIRST_NAME} {currentRow.LAST_NAME}</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600">{currentRow.EMAIL_ADDRESS}</span>
          {currentRow.COMPANY && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">{currentRow.COMPANY}</span>
            </>
          )}
          {currentRow.CATEGORY && (
            <>
              <span className="text-gray-300">·</span>
              <span className="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-700">
                {currentRow.CATEGORY}
              </span>
            </>
          )}
        </div>

        {/* Unmatched token warning */}
        {unmatchedTokens.length > 0 && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-start gap-2">
            <AlertCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Column mismatch:</span>{' '}
              {unmatchedTokens.map((t) => `{{${t}}}`).join(', ')} not found in your data.
              Check that your Excel column headers match exactly (e.g. <code className="font-mono bg-amber-100 px-0.5 rounded">FIRST_NAME</code>, <code className="font-mono bg-amber-100 px-0.5 rounded">EMAIL_ADDRESS</code>).
            </span>
          </div>
        )}

        {/* Preview tabs */}
        <div className="flex gap-0 border-b border-gray-200">
          {([
            { id: 'subject', label: 'Subject', Icon: FileTextIcon },
            { id: 'html',    label: 'HTML',    Icon: MonitorIcon  },
            { id: 'text',    label: 'Plain Text', Icon: FileTextIcon },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Preview content */}
        <div>
          {activeTab === 'html' ? (
            <HtmlPreview html={previewHtml} />
          ) : (
            <pre className="px-5 py-5 text-sm text-gray-700 font-mono leading-relaxed
                            whitespace-pre-wrap break-words overflow-auto max-h-[480px]">
              {activeContent || <span className="text-gray-300 italic">No content.</span>}
            </pre>
          )}
        </div>
      </div>

      {/* Send Test Copy */}
      <div className="panel p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Send Test Copy</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Deliver a live test using the currently previewed recipient's data to any email address.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@yourdomain.com"
            className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-300
                       text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       transition-colors"
          />
          <button
            onClick={handleTestSend}
            disabled={testState.status === 'sending' || !testEmail.includes('@')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg
                       bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300
                       text-gray-700 text-sm font-medium transition-colors whitespace-nowrap
                       border border-gray-200 disabled:cursor-not-allowed"
          >
            {testState.status === 'sending' ? (
              <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SendIcon className="w-3.5 h-3.5" />
            )}
            Send Test
          </button>
        </div>

        {testState.status === 'sent' && (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2Icon className="w-3.5 h-3.5" />
            {testState.message}
          </div>
        )}
        {testState.status === 'error' && (
          <div className="flex items-center gap-2 text-xs text-red-500">
            <AlertCircleIcon className="w-3.5 h-3.5" />
            {testState.message}
          </div>
        )}
      </div>

      {/* Dispatch error */}
      {dispatchError && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
          <AlertCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Dispatch failed</p>
            <p className="text-xs text-red-500 mt-0.5">{dispatchError}</p>
          </div>
        </div>
      )}

      {/* Navigation + dispatch */}
      <div className="flex items-center justify-between">
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
          onClick={() => setConfirmVisible(true)}
          disabled={dispatching || !campaignName.trim()}
          title={!campaignName.trim() ? 'Enter a campaign name above before dispatching' : undefined}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg
                     bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400
                     text-white text-sm font-semibold
                     transition-colors duration-150 shadow-sm
                     disabled:cursor-not-allowed disabled:shadow-none"
        >
          {dispatching ? (
            <><LoaderIcon className="w-4 h-4 animate-spin" /> Dispatching…</>
          ) : (
            <><RocketIcon className="w-4 h-4" /> Dispatch Campaign</>
          )}
        </button>
      </div>

      {/* Confirm dispatch modal */}
      {confirmVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-7 flex flex-col gap-5 animate-slide-up mx-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-bold text-gray-900">Confirm Campaign Dispatch</h3>
              <p className="text-sm text-gray-500">
                You are about to send personalised emails to{' '}
                <span className="font-bold text-gray-900">{totalRows.toLocaleString()}</span> recipients.
                This action cannot be undone.
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Campaign</span>
                <span className="text-gray-900 font-medium">{campaignName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Batch ID</span>
                <span className="font-mono text-brand-600">{batchId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Recipients</span>
                <span className="text-gray-900 font-medium">{totalRows.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subject</span>
                <span className="text-gray-700 max-w-[200px] truncate">{template.subject}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmVisible(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-500
                           hover:text-gray-900 hover:border-gray-400 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispatch}
                className="flex items-center gap-2 px-5 py-2 rounded-lg
                           bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
                           transition-colors shadow-sm"
              >
                <RocketIcon className="w-4 h-4" />
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
