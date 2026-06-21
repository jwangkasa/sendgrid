'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import type { MetricsResponseBody } from '@/lib/types';

// All terminal statuses — when every row has reached one of these states,
// polling can stop because no further webhook mutations are expected.
const TERMINAL_STATUSES = new Set(['Delivered', 'Opened', 'Clicked', 'Bounced', 'Dropped', 'Failed']);

function isBatchComplete(data: MetricsResponseBody): boolean {
  return data.total > 0 && data.pending === 0;
}

interface UseMetricsPollingOptions {
  batchId:      string | null;
  idToken:      string | null;
  interval?:    number;
  overrideKey?: string | null;
}

export interface MetricsPollingResult {
  data:       MetricsResponseBody | undefined;
  isLoading:  boolean;
  isError:    boolean;
  errorMessage: string | null;
  /** True while at least one row is still in a non-terminal state */
  isLive:     boolean;
  mutate:     () => void;
}

export function useMetricsPolling({
  batchId,
  idToken,
  interval = 3000,
  overrideKey,
}: UseMetricsPollingOptions): MetricsPollingResult {

  const fetcher = useCallback(
    async (url: string): Promise<MetricsResponseBody> => {
      if (!idToken) throw new Error('No auth token available');

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
        // Bypass browser cache — metrics route already sends Cache-Control: no-store
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }

      return res.json() as Promise<MetricsResponseBody>;
    },
    [idToken]
  );

  const key = overrideKey
    ? (idToken ? overrideKey : null)
    : (batchId && idToken ? `/api/campaign/metrics?batchId=${encodeURIComponent(batchId)}` : null);

  const { data, error, isLoading, mutate } = useSWR<MetricsResponseBody>(
    key,
    fetcher,
    {
      // Poll every `interval` ms
      refreshInterval: (latestData) => {
        // Stop polling when the batch is fully resolved
        if (latestData && isBatchComplete(latestData)) return 0;
        return interval;
      },
      // Pause polling when the browser tab is hidden to avoid unnecessary HANA load
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      // Keep displaying stale data while revalidating so the UI never blanks
      revalidateOnFocus: true,
      dedupingInterval: Math.max(interval - 500, 500),
      shouldRetryOnError: true,
      errorRetryCount: 5,
      errorRetryInterval: 2000,
    }
  );

  const isLive = data ? !isBatchComplete(data) : true;

  return {
    data,
    isLoading,
    isError:      !!error,
    errorMessage: error instanceof Error ? error.message : error ? String(error) : null,
    isLive,
    mutate: () => mutate(),
  };
}
