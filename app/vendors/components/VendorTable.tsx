'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type RowSelectionState,
} from '@tanstack/react-table';
import type { VendorRow } from '@/app/api/vendors/route';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
  LoaderIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import type { VendorFilters } from '@/app/vendors/page';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditableField = keyof Omit<VendorRow, 'LAST_MODIFIED'>;

type DraftRow = Record<EditableField, string>;

interface EditState {
  rowKey:  string;       // __rowKey of the row being edited
  draft:   DraftRow;     // current edits
  saving:  boolean;
  error:   string | null;
}

// ─── Editable fields config ───────────────────────────────────────────────────

const EDITABLE_FIELDS: { field: EditableField; label: string; width: number; mono?: boolean }[] = [
  { field: 'First Name',           label: 'First Name',   width: 120 },
  { field: 'Last Name',            label: 'Last Name',    width: 120 },
  { field: 'Title',                label: 'Title',        width: 130 },
  { field: 'Company Name',         label: 'Company',      width: 160 },
  { field: 'Email',                label: 'Email',        width: 200, mono: true },
  { field: 'Corporate Phone',      label: 'Phone',        width: 130 },
  { field: 'category',             label: 'Category',     width: 120 },
  { field: 'Industry',             label: 'Industry',     width: 140 },
];

// ─── Inline input ─────────────────────────────────────────────────────────────

interface CellInputProps {
  value:    string;
  mono?:    boolean;
  onChange: (v: string) => void;
  onEnter:  () => void;
  onEscape: () => void;
}

function CellInput({ value, mono, onChange, onEnter, onEscape }: CellInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter')  { e.preventDefault(); onEnter();  }
        if (e.key === 'Escape') { e.preventDefault(); onEscape(); }
      }}
      autoFocus={false}
      className={`w-full px-2 py-1 text-xs rounded border border-brand-400
                  bg-brand-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500
                  ${mono ? 'font-mono' : ''}`}
    />
  );
}

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<VendorRow & { __rowKey: string }>();

// ─── Main component ───────────────────────────────────────────────────────────

interface VendorTableProps {
  vendors:       VendorRow[];
  total:         number;
  page:          number;
  pageSize:      number;
  pageCount:     number;
  globalFilter:  string;
  rowSelection:  RowSelectionState;
  idToken:       string | null;
  filters:       VendorFilters;
  filterOptions: { categories: string[]; industries: string[] };
  onPageChange:          (page: number) => void;
  onFilterChange:        (value: string) => void;
  onFiltersChange:       (next: Partial<VendorFilters>) => void;
  onClearFilters:        () => void;
  onRowSelectionChange:  (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => void;
  onSaved:               () => void;
}

export function VendorTable({
  vendors,
  total,
  page,
  pageSize,
  pageCount,
  globalFilter,
  rowSelection,
  idToken,
  filters,
  filterOptions,
  onPageChange,
  onFilterChange,
  onFiltersChange,
  onClearFilters,
  onRowSelectionChange,
  onSaved,
}: VendorTableProps) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Attach stable row keys
  const data = useMemo(
    () => vendors.map((v, i) => ({ ...v, __rowKey: `${(page - 1) * pageSize + i}` })),
    [vendors, page, pageSize]
  );

  // ── Edit handlers ─────────────────────────────────────────────────────────

  const startEdit = useCallback((rowKey: string, vendor: VendorRow) => {
    const draft = {} as DraftRow;
    for (const { field } of EDITABLE_FIELDS) {
      draft[field] = vendor[field] ?? '';
    }
    setEditState({ rowKey, draft, saving: false, error: null });
    // Focus the first input on next tick
    setTimeout(() => firstInputRef.current?.focus(), 0);
  }, []);

  const cancelEdit = useCallback(() => setEditState(null), []);

  const updateDraft = useCallback((field: EditableField, value: string) => {
    setEditState((prev) => prev ? { ...prev, draft: { ...prev.draft, [field]: value } } : prev);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editState || !idToken) return;

    // Original email used as the row key for the WHERE clause
    const localIndex = parseInt(editState.rowKey) - (page - 1) * pageSize;
    const original   = vendors[localIndex];
    if (!original) return;
    const originalEmail = original['Email'];
    if (!originalEmail) {
      setEditState((p) => p ? { ...p, error: 'Row has no Email — cannot identify record to update.' } : p);
      return;
    }

    setEditState((p) => p ? { ...p, saving: true, error: null } : p);

    try {
      const res = await fetch('/api/vendors', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: originalEmail, fields: editState.draft }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? 'Save failed');
      }

      setEditState(null);
      onSaved();
    } catch (err) {
      setEditState((p) =>
        p ? { ...p, saving: false, error: err instanceof Error ? err.message : 'Save failed' } : p
      );
    }
  }, [editState, idToken, vendors, page, pageSize, onSaved]);

  // ── Build columns ─────────────────────────────────────────────────────────

  const columns = useMemo(() => [
    // Actions column (Edit / Save / Cancel)
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const rowKey  = row.original.__rowKey;
        const isEditing = editState?.rowKey === rowKey;
        const anyEditing = editState !== null;

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={saveEdit}
                disabled={editState.saving}
                title="Save"
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold
                           bg-brand-600 hover:bg-brand-500 text-white transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {editState.saving
                  ? <LoaderIcon className="w-3 h-3 animate-spin" />
                  : <SaveIcon className="w-3 h-3" />
                }
                Save
              </button>
              <button
                onClick={cancelEdit}
                disabled={editState.saving}
                title="Cancel"
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100
                           transition-colors disabled:opacity-50"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }

        return (
          <button
            onClick={() => startEdit(rowKey, row.original)}
            disabled={anyEditing}
            title={anyEditing ? 'Finish editing the current row first' : 'Edit row'}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                       text-gray-500 hover:text-brand-600 hover:bg-brand-50 border border-transparent
                       hover:border-brand-200 transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <PencilIcon className="w-3 h-3" />
            Edit
          </button>
        );
      },
      size: 100,
      enableSorting: false,
    }),

    // Checkbox column
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected(); }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          disabled={editState !== null}
          className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 cursor-pointer
                     disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Select all on this page"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          disabled={editState !== null}
          className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 cursor-pointer
                     disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Select row"
        />
      ),
      size: 40,
      enableSorting: false,
    }),

    // Editable data columns
    ...EDITABLE_FIELDS.map(({ field, label, width, mono }, colIndex) =>
      columnHelper.accessor(field, {
        header: label,
        cell: ({ row, getValue }) => {
          const rowKey    = row.original.__rowKey;
          const isEditing = editState?.rowKey === rowKey;

          if (isEditing) {
            return (
              <input
                ref={colIndex === 0 ? firstInputRef : undefined}
                value={editState.draft[field]}
                onChange={(e) => updateDraft(field, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  { e.preventDefault(); saveEdit();  }
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                }}
                className={`w-full px-2 py-1 text-xs rounded border border-brand-400
                            bg-brand-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500
                            ${mono ? 'font-mono' : ''}`}
              />
            );
          }

          const val = getValue();
          if (field === 'category' && val) {
            return (
              <span className="inline-flex px-2 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-700 text-[11px]">
                {val}
              </span>
            );
          }
          if (field === 'Email') {
            return (
              <span className={`text-gray-600 font-mono text-[11px] ${!val ? 'text-gray-300 italic' : ''}`}>
                {val || '—'}
              </span>
            );
          }
          return (
            <span className={`text-xs ${!val ? 'text-gray-300 italic' : 'text-gray-700'}`}>
              {val || '—'}
            </span>
          );
        },
        size: width,
      })
    ),

    // Last Modified (read-only)
    columnHelper.accessor('LAST_MODIFIED', {
      id: 'LAST_MODIFIED',
      header: 'Last Modified',
      cell: ({ getValue }) => {
        const raw = getValue();
        if (!raw) return <span className="text-gray-300 italic text-xs">—</span>;
        const d = new Date(raw);
        return (
          <span className="text-gray-400 text-[11px] tabular-nums whitespace-nowrap">
            {d.toLocaleString([], {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        );
      },
      size: 150,
      enableSorting: false,
    }),
  ], [editState, saveEdit, cancelEdit, startEdit, updateDraft]);

  // ── Table instance ────────────────────────────────────────────────────────

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      rowSelection,
      pagination: { pageIndex: 0, pageSize },
    },
    getRowId: (row) => row.__rowKey,
    onRowSelectionChange: (updater) => {
      if (editState) return; // block selection changes while editing
      onRowSelectionChange(
        typeof updater === 'function' ? updater(rowSelection) : updater
      );
    },
    onGlobalFilterChange: onFilterChange,
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn:        'includesString',
    manualPagination:      true,
    pageCount,
  });

  const selectedCount = Object.keys(rowSelection).length;
  const anyEditing    = editState !== null;

  const activeFilterCount = [
    filters.category,
    filters.industry,
    filters.lastModifiedFrom,
    filters.lastModifiedTo,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 px-4 pt-4 pb-3 border-b border-gray-100 bg-gray-50/60">
        {/* Category */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Category</label>
          <select
            value={filters.category}
            onChange={(e) => onFiltersChange({ category: e.target.value })}
            disabled={anyEditing}
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <option value="">All categories</option>
            {filterOptions.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Industry */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Industry</label>
          <select
            value={filters.industry}
            onChange={(e) => onFiltersChange({ industry: e.target.value })}
            disabled={anyEditing}
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <option value="">All industries</option>
            {filterOptions.industries.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        {/* Last Modified From */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Modified from</label>
          <input
            type="date"
            value={filters.lastModifiedFrom}
            onChange={(e) => onFiltersChange({ lastModifiedFrom: e.target.value })}
            disabled={anyEditing}
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>

        {/* Last Modified To */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Modified to</label>
          <input
            type="date"
            value={filters.lastModifiedTo}
            onChange={(e) => onFiltersChange({ lastModifiedTo: e.target.value })}
            disabled={anyEditing}
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            disabled={anyEditing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200
                       bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
          >
            <XIcon className="w-3 h-3" />
            Clear filters
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
              {activeFilterCount}
            </span>
          </button>
        )}

        {activeFilterCount === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 self-end pb-1.5">
            <SlidersHorizontalIcon className="w-3 h-3" />
            No filters active
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-gray-200">
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            disabled={anyEditing}
            placeholder="Search name, company, email, category…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-300
                       text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <span className="text-xs text-gray-400 flex-shrink-0">
          {total.toLocaleString()} vendors
          {selectedCount > 0 && !anyEditing && (
            <span className="ml-1 font-semibold text-brand-600">· {selectedCount} selected</span>
          )}
          {anyEditing && (
            <span className="ml-1 font-semibold text-amber-600">· editing row — save or cancel to continue</span>
          )}
        </span>
      </div>

      {/* Inline edit error */}
      {editState?.error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
          <XIcon className="w-3.5 h-3.5 flex-shrink-0" />
          {editState.error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              {table.getFlatHeaders().map((header) => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap
                             border-b border-gray-200 select-none"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-gray-400 italic"
                >
                  No vendors found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const rowKey    = row.original.__rowKey;
                const isEditing = editState?.rowKey === rowKey;
                const isLocked  = anyEditing && !isEditing;

                return (
                  <tr
                    key={row.id}
                    className={[
                      'border-b border-gray-100 transition-colors',
                      isEditing ? 'bg-brand-50 ring-1 ring-inset ring-brand-300'
                        : isLocked ? 'opacity-40 pointer-events-none'
                        : row.getIsSelected() ? 'bg-brand-50'
                        : 'hover:bg-gray-50 cursor-pointer',
                    ].join(' ')}
                    onClick={!isEditing && !isLocked ? row.getToggleSelectedHandler() : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="px-3 py-2 max-w-0"
                        onClick={
                          cell.column.id === 'select' || cell.column.id === 'actions'
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-400">
          Page <span className="font-semibold text-gray-600">{page}</span> of{' '}
          <span className="font-semibold text-gray-600">{pageCount || 1}</span>
          {' '}·{' '}
          <span className="font-semibold text-gray-600">{pageSize}</span> rows/page
        </span>

        <div className="flex items-center gap-1">
          {[
            { icon: ChevronsLeftIcon,  label: 'First page',    onClick: () => onPageChange(1),           disabled: page <= 1 },
            { icon: ChevronLeftIcon,   label: 'Previous page', onClick: () => onPageChange(page - 1),    disabled: page <= 1 },
            { icon: ChevronRightIcon,  label: 'Next page',     onClick: () => onPageChange(page + 1),    disabled: page >= pageCount },
            { icon: ChevronsRightIcon, label: 'Last page',     onClick: () => onPageChange(pageCount),   disabled: page >= pageCount },
          ].map(({ icon: Icon, label, onClick, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled || anyEditing}
              aria-label={label}
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200
                         disabled:opacity-25 disabled:cursor-default transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
