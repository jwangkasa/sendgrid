'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  XIcon,
  SparklesIcon,
  LoaderIcon,
  RocketIcon,
  UsersIcon,
} from 'lucide-react';
import type { AiAnalysisResult, AiSegmentDraft, RecipientRow } from '@/lib/types';

type SegmentKey = 'engaged' | 'unresponsive' | 'failed';
type PanelTab   = 'summary' | SegmentKey;

const SEGMENT_LABELS: Record<SegmentKey, { label: string; color: string; dot: string }> = {
  engaged:      { label: 'Engaged',      color: 'text-emerald-700', dot: 'bg-emerald-500' },
  unresponsive: { label: 'Unresponsive', color: 'text-amber-700',   dot: 'bg-amber-500'   },
  failed:       { label: 'Failed',       color: 'text-red-700',     dot: 'bg-red-500'     },
};

interface AiFollowUpPanelProps {
  selectedBatchIds: string[];
  idToken: string | null;
  onClose: () => void;
}

export function AiFollowUpPanel({ selectedBatchIds, idToken, onClose }: AiFollowUpPanelProps) {
  const router = useRouter();

  const [status,    setStatus]    = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>('summary');

  // AI result (mutable so we can patch subject/body edits)
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [drafts, setDrafts] = useState<Record<SegmentKey, AiSegmentDraft> | null>(null);

  // Recipients per segment (streamed as a trailer after the JSON)
  const recipientsRef = useRef<Record<SegmentKey, RecipientRow[]>>({
    engaged: [], unresponsive: [], failed: [],
  });

  const runAnalysis = useCallback(async () => {
    if (!idToken || selectedBatchIds.length === 0) return;
    setStatus('loading');
    setErrorMsg(null);
    setResult(null);
    setDrafts(null);

    try {
      const res = await fetch('/api/campaign/analyse', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${idToken}`,
        },
        body: JSON.stringify({ batchIds: selectedBatchIds }),
      });

      if (!res.ok) {
        const { message } = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(message);
      }

      // Read the full streamed text
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   raw     = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }

      // Split AI JSON from recipients trailer
      const SEPARATOR = '\n\n__RECIPIENTS__\n';
      const sepIdx    = raw.indexOf(SEPARATOR);
      const jsonPart  = sepIdx >= 0 ? raw.slice(0, sepIdx) : raw;
      const recPart   = sepIdx >= 0 ? raw.slice(sepIdx + SEPARATOR.length) : null;

      const parsed: AiAnalysisResult = JSON.parse(jsonPart);
      setResult(parsed);
      setDrafts({ ...parsed.segments });

      if (recPart) {
        recipientsRef.current = JSON.parse(recPart);
      }

      setStatus('done');
      setActiveTab('summary');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStatus('error');
    }
  }, [idToken, selectedBatchIds]);

  const patchDraft = (seg: SegmentKey, field: 'subject' | 'body', value: string) => {
    setDrafts((prev) => prev ? { ...prev, [seg]: { ...prev[seg], [field]: value } } : prev);
  };

  const launchFollowUp = (seg: SegmentKey) => {
    const draft      = drafts?.[seg];
    const recipients = recipientsRef.current[seg];
    if (!draft || recipients.length === 0) return;

    sessionStorage.setItem('ai_followup_prefill', JSON.stringify({
      recipients,
      subject:  draft.subject,
      htmlBody: draft.body,
    }));
    router.push('/campaign');
  };

  return (
    <div className="fixed inset-0 z-30 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-[500px] h-full bg-white shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-semibold text-gray-900">AI Follow-Up</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-700 font-medium">
              SAP AI Core
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Idle */}
          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center gap-5 h-full px-8 text-center">
              <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
                <SparklesIcon className="w-7 h-7 text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Analyse your campaign</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  SAP AI Core will summarise performance, segment your recipients, and draft
                  personalised follow-up emails for each group.
                </p>
              </div>
              {selectedBatchIds.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Select at least one campaign to analyse.
                </p>
              )}
              <button
                onClick={runAnalysis}
                disabled={selectedBatchIds.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500
                           text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors shadow-sm"
              >
                <SparklesIcon className="w-4 h-4" />
                Analyse Campaign
              </button>
            </div>
          )}

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-4 h-full px-8 text-center">
              <LoaderIcon className="w-8 h-8 text-brand-500 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Analysing with SAP AI Core…</p>
                <p className="text-xs text-gray-500 mt-1">Segmenting recipients and drafting follow-ups</p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center gap-4 h-full px-8 text-center">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {errorMsg}
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="text-xs text-brand-600 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Done */}
          {status === 'done' && result && drafts && (
            <div className="flex flex-col h-full">
              {/* Tabs */}
              <div className="flex border-b border-gray-200 px-5 flex-shrink-0">
                {(['summary', 'engaged', 'unresponsive', 'failed'] as PanelTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors capitalize whitespace-nowrap
                      ${activeTab === tab
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                  >
                    {tab === 'summary' ? 'Summary' : SEGMENT_LABELS[tab].label}
                    {tab !== 'summary' && (
                      <span className="ml-1.5 tabular-nums text-[10px] bg-gray-100 text-gray-500 rounded px-1">
                        {drafts[tab].count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5">

                {/* Summary tab */}
                {activeTab === 'summary' && (
                  <div className="flex flex-col gap-4">
                    <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                      {result.summary}
                    </div>

                    {/* Segment count pills */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {(Object.keys(SEGMENT_LABELS) as SegmentKey[]).map((seg) => (
                        <button
                          key={seg}
                          onClick={() => setActiveTab(seg)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <span className={`w-2 h-2 rounded-full ${SEGMENT_LABELS[seg].dot}`} />
                          <span className={`text-xs font-medium ${SEGMENT_LABELS[seg].color}`}>
                            {SEGMENT_LABELS[seg].label}
                          </span>
                          <span className="text-xs text-gray-400 tabular-nums">{drafts[seg].count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Segment tabs */}
                {(activeTab === 'engaged' || activeTab === 'unresponsive' || activeTab === 'failed') && (
                  <SegmentEditor
                    segKey={activeTab}
                    draft={drafts[activeTab]}
                    recipientCount={recipientsRef.current[activeTab].length}
                    onChange={(field, val) => patchDraft(activeTab, field, val)}
                    onLaunch={() => launchFollowUp(activeTab)}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer re-run button */}
        {status === 'done' && (
          <div className="px-5 py-3 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={runAnalysis}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300
                         bg-white text-xs text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              Re-analyse
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Segment editor sub-component ────────────────────────────────────────────

interface SegmentEditorProps {
  segKey:         SegmentKey;
  draft:          AiSegmentDraft;
  recipientCount: number;
  onChange:       (field: 'subject' | 'body', value: string) => void;
  onLaunch:       () => void;
}

function SegmentEditor({ segKey, draft, recipientCount, onChange, onLaunch }: SegmentEditorProps) {
  const cfg = SEGMENT_LABELS[segKey];
  return (
    <div className="flex flex-col gap-4">
      {/* Recipient count */}
      <div className="flex items-center gap-2">
        <UsersIcon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-500">
          <span className={`font-semibold ${cfg.color}`}>{recipientCount.toLocaleString()}</span> recipients in this segment
        </span>
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600">Subject line</label>
        <input
          type="text"
          value={draft.subject}
          onChange={(e) => onChange('subject', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-900
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600">Email body (HTML)</label>
        <textarea
          value={draft.body}
          onChange={(e) => onChange('body', e.target.value)}
          rows={12}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs text-gray-800 font-mono
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-y"
        />
        <p className="text-[10px] text-gray-400">
          Tokens: <code className="font-mono">{'{{FIRST_NAME}}'}</code> · <code className="font-mono">{'{{COMPANY}}'}</code>
        </p>
      </div>

      {/* Launch */}
      <button
        onClick={onLaunch}
        disabled={recipientCount === 0}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                   bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium
                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        <RocketIcon className="w-4 h-4" />
        Launch Follow-Up Campaign
      </button>
    </div>
  );
}
