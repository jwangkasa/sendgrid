'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMetricsPolling } from './components/useMetricsPolling';
import { KPICards } from './components/KPICards';
import { RecipientTable } from './components/RecipientTable';
import {
  PlusIcon,
  RefreshCwIcon,
  LogOutIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
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
  return m > 0
    ? `${m}m ${s.toString().padStart(2, '0')}s`
    : `${s}s`;
}

// ─── Live indicator dot ───────────────────────────────────────────────────────

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

// ─── Skeleton loader ──────────────────────────────────────────────────────────

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

// ─── Dashboard page ───────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, loading: authLoading, idToken, signOut } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const batchId      = searchParams.get('batchId');

  const startTimeRef = useRef<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Capture start time once on mount
  useEffect(() => {
    if (!startTimeRef.current) {
      startTimeRef.current = new Date();
      setStartTime(startTimeRef.current);
    }
  }, []);

  const elapsed = useElapsedSeconds(startTime);

  const { data, isLoading, isError, errorMessage, isLive, mutate } = useMetricsPolling({
    batchId,
    idToken,
    interval: 3000,
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!batchId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="panel p-8 flex flex-col items-center gap-4 max-w-sm text-center animate-fade-in">
          <AlertCircleIcon className="w-10 h-10 text-amber-500" />
          <div>
            <p className="text-gray-900 font-semibold">No batch selected</p>
            <p className="text-gray-500 text-sm mt-1">
              Navigate here from the campaign wizard after dispatching.
            </p>
          </div>
          <button
            onClick={() => router.push('/campaign')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600
                       hover:bg-brand-500 text-white text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Start New Campaign
          </button>
        </div>
      </div>
    );
  }

  // ── Last updated display ─────────────────────────────────────────────────────
  const lastUpdated = data
    ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: brand + batch info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Logo size="sm" />
              <span className="text-sm font-semibold text-gray-900 hidden sm:block">Campaign Analytics</span>
            </div>

            {/* Nav tabs */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => router.push('/vendors')}
                className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors"
              >
                Vendor Campaign
              </button>
              <button
                onClick={() => router.push('/campaign')}
                className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors"
              >
                New Campaign
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
                Dashboard
              </span>
            </nav>

            <div className="w-px h-5 bg-gray-200 hidden sm:block" />

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-400 hidden sm:block">Batch</span>
              <span className="font-mono text-xs text-brand-600 font-semibold truncate max-w-[160px]">
                {batchId}
              </span>
            </div>
          </div>

          {/* Right: live indicator, elapsed, controls */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <LiveDot isLive={isLive} />

            <span className="text-xs text-gray-400 hidden sm:block tabular-nums">
              {formatElapsed(elapsed)}
            </span>

            {lastUpdated && (
              <span className="text-[11px] text-gray-400 hidden md:block">
                Updated {lastUpdated}
              </span>
            )}

            <button
              onClick={() => mutate()}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100
                         transition-colors"
              title="Refresh now"
            >
              <RefreshCwIcon className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 bg-gray-200" />

            <button
              onClick={() => router.push('/campaign')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium
                         transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
              <span className="hidden sm:inline">New Campaign</span>
            </button>

            {user && (
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-xs text-gray-400
                           hover:text-gray-700 transition-colors"
                title="Sign out"
              >
                <LogOutIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8 flex flex-col gap-7">

        {/* Page heading + completion banner */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Real-time Delivery Dashboard
            </h1>
            {!isLive && data && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                               bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <CheckCircle2Icon className="w-3 h-3" />
                Batch complete
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Polling every 3 seconds · {data?.total.toLocaleString() ?? '—'} total recipients
          </p>
        </div>

        {/* Error banner */}
        {isError && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 animate-fade-in">
            <AlertCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Metrics fetch error</p>
              <p className="text-xs text-red-500 mt-0.5">
                {errorMessage ?? 'Unknown error'} — retrying automatically.
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        {isLoading && !data ? (
          <SkeletonCards />
        ) : data ? (
          <div className="animate-fade-in">
            <KPICards metrics={data} />
          </div>
        ) : null}

        {/* Status breakdown bar */}
        {data && data.total > 0 && (
          <div className="flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Status distribution</span>
              <span>{data.total.toLocaleString()} total</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 gap-px">
              {[
                { count: data.delivered,                 color: 'bg-emerald-500' },
                { count: data.opened,                    color: 'bg-sky-500'     },
                { count: data.clicked,                   color: 'bg-violet-500'  },
                { count: data.bounced,                   color: 'bg-red-500'     },
                { count: data.dropped + data.failed,     color: 'bg-amber-500'   },
                { count: data.pending,                   color: 'bg-gray-400'    },
              ]
                .filter((s) => s.count > 0)
                .map((s, i) => (
                  <div
                    key={i}
                    className={`${s.color} transition-all duration-700`}
                    style={{ width: `${(s.count / data.total) * 100}%` }}
                  />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
              {[
                { label: 'Delivered',      count: data.delivered,              color: 'bg-emerald-500' },
                { label: 'Opened',         count: data.opened,                 color: 'bg-sky-500'     },
                { label: 'Clicked',        count: data.clicked,                color: 'bg-violet-500'  },
                { label: 'Bounced',        count: data.bounced,                color: 'bg-red-500'     },
                { label: 'Dropped/Failed', count: data.dropped + data.failed,  color: 'bg-amber-500'   },
                { label: 'In Progress',    count: data.pending,                color: 'bg-gray-400'    },
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
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recipient Details</h2>
            {data && (
              <span className="text-xs text-gray-400">
                {data.rows.length.toLocaleString()} rows
              </span>
            )}
          </div>

          {isLoading && !data ? (
            <SkeletonTable />
          ) : data ? (
            <RecipientTable rows={data.rows} />
          ) : null}
        </div>
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
