'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { useMetricsPolling } from './components/useMetricsPolling';
import { KPICards } from './components/KPICards';
import { RecipientTable } from './components/RecipientTable';
import type { BatchSummary } from '@/app/api/campaign/batches/route';
import {
  PlusIcon,
  RefreshCwIcon,
  LogOutIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ChevronDownIcon,
  XIcon,
} from 'lucide-react';
import { Logo } from '@/app/components/Logo';

// ─── Elapsed time counter ─────────────────────────────────────────────────────

function useElapsedSeconds(startAt: Date | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startAt) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startAt]);
  return elapsed;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

// ─── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot({ isLive }: { isLive: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      </span>
      <span className={`text-xs font-medium ${isLive ? 'text-emerald-600' : 'text-gray-400'}`}>
        {isLive ? 'Live' : 'Complete'}
      </span>
    </span>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel p-5 h-[120px] animate-pulse bg-gray-100" />
      ))}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="h-9 rounded-lg bg-gray-100 animate-pulse w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 rounded bg-gray-50 animate-pulse w-full" />
      ))}
    </div>
  );
}

// ─── Batch multi-select dropdown ──────────────────────────────────────────────

interface BatchSelectorProps {
  batches:        BatchSummary[];
  selectedIds:    Set<string>;
  onToggle:       (id: string) => void;
  onSelectAll:    () => void;
  onClearAll:     () => void;
}

function BatchSelector({ batches, selectedIds, onToggle, onSelectAll, onClearAll }: BatchSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = batches.length > 0 && selectedIds.size === batches.length;
  const label = allSelected
    ? 'All campaigns'
    : selectedIds.size === 0
    ? 'No campaigns selected'
    : selectedIds.size === 1
    ? (batches.find((b) => selectedIds.has(b.batchId))?.campaignName ?? '1 campaign')
    : `${selectedIds.size} campaigns`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300
                   bg-white text-xs text-gray-700 font-medium hover:bg-gray-50
                   transition-colors min-w-[180px] justify-between"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-gray-200
                        bg-white shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Filter by Campaign
            </span>
            <div className="flex items-center gap-2">
              <button onClick={onSelectAll} className="text-[11px] text-brand-600 hover:underline font-medium">
                All
              </button>
              <span className="text-gray-300">·</span>
              <button onClick={onClearAll} className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline">
                None
              </button>
            </div>
          </div>

          {/* Batch list */}
          <div className="max-h-72 overflow-y-auto">
            {batches.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">No campaigns found</p>
            ) : (
              batches.map((b) => (
                <label
                  key={b.batchId}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer
                             border-b border-gray-50 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(b.batchId)}
                    onChange={() => onToggle(b.batchId)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-semibold text-gray-800 truncate">{b.campaignName}</span>
                    <span className="text-[10px] text-gray-400 font-mono truncate">{b.batchId}</span>
                    <span className="text-[10px] text-gray-400">
                      {b.total.toLocaleString()} recipients
                      {b.sentAt ? ` · ${new Date(b.sentAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard content ────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, loading: authLoading, idToken, signOut } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initialBatch = searchParams.get('batchId');

  const startTimeRef = useRef<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    initialBatch ? new Set([initialBatch]) : new Set()
  );

  useEffect(() => {
    if (!startTimeRef.current) {
      startTimeRef.current = new Date();
      setStartTime(startTimeRef.current);
    }
  }, []);

  const elapsed = useElapsedSeconds(startTime);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // ── Fetch all batches ────────────────────────────────────────────────────────
  const batchFetcher = useCallback(async (url: string) => {
    if (!idToken) throw new Error('No auth token');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [idToken]);

  const { data: batchData } = useSWR<{ batches: BatchSummary[] }>(
    idToken ? '/api/campaign/batches' : null,
    batchFetcher,
    { revalidateOnFocus: false }
  );

  const batches = batchData?.batches ?? [];

  // Auto-select all batches once loaded (if no initial batchId in URL)
  useEffect(() => {
    if (batches.length > 0 && selectedIds.size === 0 && !initialBatch) {
      setSelectedIds(new Set(batches.map((b) => b.batchId)));
    }
  }, [batches, initialBatch, selectedIds.size]);

  // ── Metrics for selected batches ─────────────────────────────────────────────
  const batchIdParam = selectedIds.size > 0
    ? Array.from(selectedIds).map((id) => `batchId=${encodeURIComponent(id)}`).join('&')
    : null;

  const { data, isLoading, isError, errorMessage, isLive, mutate } = useMetricsPolling({
    batchId: batchIdParam ? `__multi__` : null,
    idToken,
    interval: 3000,
    overrideKey: batchIdParam ? `/api/campaign/metrics?${batchIdParam}` : null,
  });

  // ── Batch selector handlers ──────────────────────────────────────────────────
  const toggleBatch = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll  = useCallback(() => setSelectedIds(new Set(batches.map((b) => b.batchId))), [batches]);
  const clearAll   = useCallback(() => setSelectedIds(new Set()), []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const lastUpdated = data
    ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Logo size="sm" />
              <span className="text-sm font-semibold text-gray-900 hidden sm:block">Campaign Analytics</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <button onClick={() => router.push('/vendors')} className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors">
                Vendor Campaign
              </button>
              <button onClick={() => router.push('/campaign')} className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors">
                New Campaign
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
                Dashboard
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <LiveDot isLive={isLive} />
            <span className="text-xs text-gray-400 hidden sm:block tabular-nums">{formatElapsed(elapsed)}</span>
            {lastUpdated && (
              <span className="text-[11px] text-gray-400 hidden md:block">Updated {lastUpdated}</span>
            )}
            <button onClick={() => mutate()} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Refresh">
              <RefreshCwIcon className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <button onClick={() => router.push('/campaign')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors">
              <PlusIcon className="w-3 h-3" />
              <span className="hidden sm:inline">New Campaign</span>
            </button>
            {user && (
              <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors" title="Sign out">
                <LogOutIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8 flex flex-col gap-7">

        {/* Heading + batch selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Real-time Delivery Dashboard
              {!isLive && data && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                  <CheckCircle2Icon className="w-3 h-3" />
                  Complete
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500">
              {data
                ? `${data.total.toLocaleString()} total recipients · polling every 3s`
                : 'Select one or more campaigns to view metrics'}
            </p>
          </div>

          <BatchSelector
            batches={batches}
            selectedIds={selectedIds}
            onToggle={toggleBatch}
            onSelectAll={selectAll}
            onClearAll={clearAll}
          />
        </div>

        {/* Selected campaign chips + unselect all */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.size === batches.length ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                               bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium">
                All {batches.length} campaigns
                <button onClick={clearAll} title="Unselect all" className="text-brand-400 hover:text-brand-700">
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <>
                {Array.from(selectedIds).map((id) => {
                  const b = batches.find((b) => b.batchId === id);
                  return (
                    <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                              bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium">
                      {b?.campaignName ?? id}
                      <button onClick={() => toggleBatch(id)} className="text-brand-400 hover:text-brand-700">
                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
                >
                  Unselect all
                </button>
              </>
            )}
          </div>
        )}

        {/* No selection state */}
        {selectedIds.size === 0 && (
          <div className="panel p-10 flex flex-col items-center gap-4 text-center">
            <AlertCircleIcon className="w-10 h-10 text-gray-300" />
            <div>
              <p className="text-gray-700 font-semibold">No campaigns selected</p>
              <p className="text-gray-400 text-sm mt-1">Use the campaign filter above to select one or more campaigns.</p>
            </div>
            <button onClick={selectAll} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors">
              Show all campaigns
            </button>
          </div>
        )}

        {selectedIds.size > 0 && (
          <>
            {/* Error banner */}
            {isError && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                <AlertCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700">Metrics fetch error</p>
                  <p className="text-xs text-red-500 mt-0.5">{errorMessage ?? 'Unknown error'} — retrying automatically.</p>
                </div>
              </div>
            )}

            {/* KPI cards */}
            {isLoading && !data ? <SkeletonCards /> : data ? <KPICards metrics={data} /> : null}

            {/* Status bar */}
            {data && data.total > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Status distribution</span>
                  <span>{data.total.toLocaleString()} total</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 gap-px">
                  {[
                    { count: data.delivered,             color: 'bg-emerald-500' },
                    { count: data.opened,                color: 'bg-sky-500'     },
                    { count: data.clicked,               color: 'bg-violet-500'  },
                    { count: data.bounced,               color: 'bg-red-500'     },
                    { count: data.dropped + data.failed, color: 'bg-amber-500'   },
                    { count: data.pending,               color: 'bg-gray-400'    },
                  ].filter((s) => s.count > 0).map((s, i) => (
                    <div key={i} className={`${s.color} transition-all duration-700`}
                      style={{ width: `${(s.count / data.total) * 100}%` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                  {[
                    { label: 'Delivered',      count: data.delivered,             color: 'bg-emerald-500' },
                    { label: 'Opened',         count: data.opened,                color: 'bg-sky-500'     },
                    { label: 'Clicked',        count: data.clicked,               color: 'bg-violet-500'  },
                    { label: 'Bounced',        count: data.bounced,               color: 'bg-red-500'     },
                    { label: 'Dropped/Failed', count: data.dropped + data.failed, color: 'bg-amber-500'   },
                    { label: 'In Progress',    count: data.pending,               color: 'bg-gray-400'    },
                  ].map((s) => (
                    <span key={s.label} className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-sm ${s.color}`} />
                      {s.label} ({s.count.toLocaleString()})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recipient table */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Recipient Details</h2>
                {data && <span className="text-xs text-gray-400">{data.rows.length.toLocaleString()} rows</span>}
              </div>
              {isLoading && !data ? <SkeletonTable /> : data ? <RecipientTable rows={data.rows} /> : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
