'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import type { RowSelectionState } from '@tanstack/react-table';
import type { VendorRow } from '@/app/api/vendors/route';
import type { RecipientRow } from '@/lib/types';
import { VendorTable } from './components/VendorTable';
import { LogOutIcon, SendIcon, BuildingIcon, PaintbrushIcon, CheckIcon, MailPlusIcon, LayoutDashboardIcon, GitBranchIcon } from 'lucide-react';
import { Logo } from '@/app/components/Logo';
import { TemplateBuilder } from '@/app/campaign/components/TemplateBuilder';

const PAGE_SIZE = 10;

interface VendorsResponse {
  vendors:   VendorRow[];
  total:     number;
  page:      number;
  pageSize:  number;
  pageCount: number;
}

interface FiltersResponse {
  categories: string[];
  industries:  string[];
}

export interface VendorFilters {
  category:         string;
  industry:         string;
  lastModifiedFrom: string;
  lastModifiedTo:   string;
  search:           string;
}

function buildVendorKey(page: number, filters: VendorFilters, idToken: string | null): string | null {
  if (!idToken) return null;
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (filters.search)           params.set('search',           filters.search);
  if (filters.category)         params.set('category',         filters.category);
  if (filters.industry)         params.set('industry',         filters.industry);
  if (filters.lastModifiedFrom) params.set('lastModifiedFrom', filters.lastModifiedFrom);
  if (filters.lastModifiedTo)   params.set('lastModifiedTo',   filters.lastModifiedTo);
  return `/api/vendors?${params.toString()}`;
}

function mapVendorToRecipient(v: VendorRow): RecipientRow {
  return {
    FIRST_NAME:    v['First Name']    ?? '',
    LAST_NAME:     v['Last Name']     ?? '',
    EMAIL_ADDRESS: v['Email']         ?? '',
    COMPANY:       v['Company Name']  ?? '',
    PHONE_NUMBER:  v['Corporate Phone'] ?? '',
    CATEGORY:      v['category']      ?? '',
    COMMENTS:      '',
    Title:                    v['Title']                    ?? '',
    Industry:                 v['Industry']                 ?? '',
    Website:                  v['Website']                  ?? '',
    'Company Linkedin Url':   v['Company Linkedin Url']     ?? '',
    'Company Address':        v['Company Address']          ?? '',
    'Personal LinkedIn':      v['Personal LinkedIn']        ?? '',
    'Industry/Service':       v['Industry/Service']         ?? '',
    'Personal LinkedIn Url':  v['Personal LinkedIn Url']    ?? '',
  };
}

export default function VendorsPage() {
  const { user, loading, signOut, idToken } = useAuth();
  const router = useRouter();

  const [page,         setPage]         = useState(1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [builderOpen,  setBuilderOpen]  = useState(false);
  const [builderCopied, setBuilderCopied] = useState(false);
  const [filters,      setFilters]      = useState<VendorFilters>({
    category:         '',
    industry:         '',
    lastModifiedFrom: '',
    lastModifiedTo:   '',
    search:           '',
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const fetcher = useCallback(
    async (url: string) => {
      if (!idToken) throw new Error('No auth token');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [idToken]
  );

  const vendorKey = buildVendorKey(page, filters, idToken);
  const { data, isLoading, error, mutate } = useSWR<VendorsResponse>(vendorKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const filtersKey = idToken ? '/api/vendors/filters' : null;
  const { data: filterOptions } = useSWR<FiltersResponse>(filtersKey, fetcher, {
    revalidateOnFocus: false,
  });

  const handleFiltersChange = useCallback((next: Partial<VendorFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
    setRowSelection({});
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ category: '', industry: '', lastModifiedFrom: '', lastModifiedTo: '', search: '' });
    setPage(1);
    setRowSelection({});
  }, []);

  const selectedCount = Object.keys(rowSelection).length;

  const handleSendCampaign = useCallback(() => {
    if (!data || selectedCount === 0) return;
    const selectedIndices = new Set(Object.keys(rowSelection));
    const pageOffset = (page - 1) * PAGE_SIZE;
    const selected: RecipientRow[] = data.vendors
      .map((v, i) => ({ vendor: v, key: String(pageOffset + i) }))
      .filter(({ key }) => selectedIndices.has(key))
      .map(({ vendor }) => mapVendorToRecipient(vendor))
      .filter((r) => r.EMAIL_ADDRESS.trim() !== '');

    if (selected.length === 0) {
      alert('None of the selected vendors have an email address.');
      return;
    }

    sessionStorage.setItem('vendor_prefill', JSON.stringify({ recipients: selected, source: 'vendor' }));
    router.push('/campaign');
  }, [data, rowSelection, selectedCount, page, router]);

  if (loading || (!loading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="text-sm font-semibold text-gray-900">Bulk Email Engine</span>
          </div>
          <nav className="hidden sm:flex items-center gap-0.5">
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
              <BuildingIcon className="w-3.5 h-3.5" />
              Vendor Campaign
            </span>
            <button onClick={() => router.push('/campaign')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors">
              <MailPlusIcon className="w-3.5 h-3.5" />
              New Campaign
            </button>
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors">
              <LayoutDashboardIcon className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setBuilderOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors"
            >
              <PaintbrushIcon className="w-3.5 h-3.5" />
              Template Builder
            </button>
            <button onClick={() => router.push('/sequences')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors">
              <GitBranchIcon className="w-3.5 h-3.5" />
              Sequences
            </button>
          </nav>
          <div className="flex items-center gap-4">
            {user && <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>}
            <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
              <LogOutIcon className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <BuildingIcon className="w-5 h-5 text-brand-600" />
              Vendor Campaign
            </h1>
            <p className="text-sm text-gray-500">
              Select vendors from your HANA database, then launch a personalised email campaign.
            </p>
          </div>
          <button
            onClick={handleSendCampaign}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg flex-shrink-0
                       bg-brand-600 hover:bg-brand-500 disabled:bg-gray-200 disabled:text-gray-400
                       text-white text-sm font-semibold transition-colors shadow-sm
                       disabled:shadow-none disabled:cursor-not-allowed"
          >
            <SendIcon className="w-4 h-4" />
            {selectedCount > 0 ? `Send Campaign (${selectedCount} selected)` : 'Send Campaign'}
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Failed to load vendors.'}
          </div>
        )}

        <div className="panel overflow-hidden">
          {isLoading && !data ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="h-9 rounded-lg bg-gray-100 animate-pulse w-full" />
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-50 animate-pulse w-full" />
              ))}
            </div>
          ) : data ? (
            <VendorTable
              vendors={data.vendors}
              total={data.total}
              page={data.page}
              pageSize={data.pageSize}
              pageCount={data.pageCount}
              globalFilter={filters.search}
              rowSelection={rowSelection}
              idToken={idToken}
              filters={filters}
              filterOptions={filterOptions ?? { categories: [], industries: [] }}
              onPageChange={setPage}
              onFilterChange={(val) => handleFiltersChange({ search: val })}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
              onRowSelectionChange={setRowSelection}
              onSaved={() => mutate()}
            />
          ) : null}
        </div>
      </main>

      {builderOpen && (
        <TemplateBuilder
          onApply={async (html) => {
            await navigator.clipboard.writeText(html);
            setBuilderOpen(false);
            setBuilderCopied(true);
            setTimeout(() => setBuilderCopied(false), 3000);
          }}
          onClose={() => setBuilderOpen(false)}
          idToken={idToken}
        />
      )}

      {builderCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                        px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm shadow-xl animate-slide-up">
          <CheckIcon className="w-4 h-4 text-emerald-400" />
          HTML copied to clipboard
        </div>
      )}
    </div>
  );
}
