'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
} from '@tanstack/react-table';
import type { RecipientLog, DeliveryStatus } from '@/lib/types';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  FilterIcon,
} from 'lucide-react';

// ─── Status badge configuration ───────────────────────────────────────────────

const STATUS_STYLES: Record<DeliveryStatus, { bg: string; text: string; dot: string }> = {
  Pending:   { bg: 'bg-gray-100',       text: 'text-gray-500',    dot: 'bg-gray-400'    },
  Queued:    { bg: 'bg-gray-100',       text: 'text-gray-600',    dot: 'bg-gray-500'    },
  Processed: { bg: 'bg-blue-50',        text: 'text-blue-700',    dot: 'bg-blue-500'    },
  Delivered: { bg: 'bg-emerald-50',     text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Opened:    { bg: 'bg-sky-50',         text: 'text-sky-700',     dot: 'bg-sky-500'     },
  Clicked:   { bg: 'bg-violet-50',      text: 'text-violet-700',  dot: 'bg-violet-500'  },
  Bounced:   { bg: 'bg-red-50',         text: 'text-red-700',     dot: 'bg-red-500'     },
  Dropped:   { bg: 'bg-amber-50',       text: 'text-amber-700',   dot: 'bg-amber-500'   },
  Failed:    { bg: 'bg-red-50',         text: 'text-red-700',     dot: 'bg-red-500'     },
};

const ALL_STATUSES: DeliveryStatus[] = [
  'Pending', 'Queued', 'Processed', 'Delivered',
  'Opened', 'Clicked', 'Bounced', 'Dropped', 'Failed',
];

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['Pending'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      {status}
    </span>
  );
}

// ─── Sort icon helper ─────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc')  return <ChevronUpIcon   className="w-3 h-3 text-brand-500" />;
  if (direction === 'desc') return <ChevronDownIcon className="w-3 h-3 text-brand-500" />;
  return <ChevronsUpDownIcon className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />;
}

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<RecipientLog>();

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 accent-brand-600 cursor-pointer"
    />
  );
}

const columns = [
  columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <IndeterminateCheckbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <IndeterminateCheckbox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
    size: 36,
    enableSorting: false,
  }),

  columnHelper.display({
    id: 'rowNum',
    header: '#',
    cell: (info) => (
      <span className="text-gray-300 tabular-nums">
        {info.table.getState().pagination.pageIndex *
          info.table.getState().pagination.pageSize +
          info.row.index + 1}
      </span>
    ),
    size: 50,
    enableSorting: false,
  }),

  columnHelper.accessor(
    (row) => `${row.FIRST_NAME ?? ''} ${row.LAST_NAME ?? ''}`.trim(),
    {
      id: 'fullName',
      header: 'Name',
      cell: (info) => (
        <span className="text-gray-800 font-medium">
          {info.getValue() || <span className="text-gray-300 italic">—</span>}
        </span>
      ),
      size: 150,
    }
  ),

  columnHelper.accessor('EMAIL_ADDRESS', {
    header: 'Email',
    cell: (info) => (
      <span className="text-gray-600 font-mono text-[11px]">{info.getValue()}</span>
    ),
    size: 200,
  }),

  columnHelper.accessor('COMPANY', {
    header: 'Company',
    cell: (info) => (
      <span className="text-gray-500 text-xs">
        {info.getValue() || <span className="text-gray-300 italic">—</span>}
      </span>
    ),
    size: 140,
  }),

  columnHelper.accessor('CATEGORY', {
    header: 'Category',
    cell: (info) => {
      const val = info.getValue();
      return val
        ? <span className="inline-flex px-2 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-700 text-[11px]">{val}</span>
        : <span className="text-gray-300 italic text-xs">—</span>;
    },
    size: 120,
  }),

  columnHelper.accessor('DELIVERY_STATUS', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue() as DeliveryStatus} />,
    filterFn: 'equals',
    size: 120,
  }),

  columnHelper.accessor('OPEN_COUNT', {
    header: 'Opens',
    cell: (info) => (
      <span className={`tabular-nums text-xs font-semibold ${info.getValue() > 0 ? 'text-sky-600' : 'text-gray-300'}`}>
        {info.getValue()}
      </span>
    ),
    size: 70,
  }),

  columnHelper.accessor('CLICK_COUNT', {
    header: 'Clicks',
    cell: (info) => (
      <span className={`tabular-nums text-xs font-semibold ${info.getValue() > 0 ? 'text-violet-600' : 'text-gray-300'}`}>
        {info.getValue()}
      </span>
    ),
    size: 70,
  }),

  columnHelper.accessor('FAILURE_REASON', {
    header: 'Failure Reason',
    cell: (info) => {
      const val = info.getValue();
      return val
        ? <span className="text-red-500 text-[11px] truncate max-w-[180px] block" title={val}>{val}</span>
        : <span className="text-gray-300 italic text-xs">—</span>;
    },
    size: 180,
    enableSorting: false,
  }),

  columnHelper.accessor('UPDATED_AT', {
    header: 'Updated',
    cell: (info) => {
      const raw = info.getValue();
      if (!raw) return <span className="text-gray-300 italic text-xs">—</span>;
      const d = new Date(raw);
      return (
        <span className="text-gray-400 text-[11px] tabular-nums whitespace-nowrap">
          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      );
    },
    size: 100,
  }),
];

// ─── Main component ───────────────────────────────────────────────────────────

interface RecipientTableProps {
  rows: RecipientLog[];
  onSelectionChange?: (selected: RecipientLog[]) => void;
}

export function RecipientTable({ rows, onSelectionChange }: RecipientTableProps) {
  const [sorting,        setSorting]       = useState<SortingState>([{ id: 'UPDATED_AT', desc: true }]);
  const [columnFilters,  setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter,   setGlobalFilter]  = useState('');
  const [statusFilter,   setStatusFilter]  = useState<string>('all');
  const [rowSelection,   setRowSelection]  = useState<RowSelectionState>({});

  // Merge the status dropdown into columnFilters
  const effectiveFilters: ColumnFiltersState = useMemo(() => {
    const base = columnFilters.filter((f) => f.id !== 'DELIVERY_STATUS');
    if (statusFilter !== 'all') {
      base.push({ id: 'DELIVERY_STATUS', value: statusFilter });
    }
    return base;
  }, [columnFilters, statusFilter]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters: effectiveFilters,
      globalFilter,
      pagination: { pageIndex: 0, pageSize: 50 },
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
    autoResetPageIndex: false,
  });

  // Notify parent whenever selection changes
  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(table.getSelectedRowModel().rows.map((r) => r.original));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const pageCount     = table.getPageCount();

  return (
    <div className="panel flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-gray-200">
        {/* Global search */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search name, email, company…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-300
                       text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <FilterIcon className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white border border-gray-300
                       text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-brand-500
                       transition-colors cursor-pointer"
          >
            <option value="all">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Result count */}
        <span className="text-xs text-gray-400 flex-shrink-0">
          {totalFiltered.toLocaleString()} of {rows.length.toLocaleString()} rows
        </span>
      </div>

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
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex items-center gap-1 group hover:text-gray-800 transition-colors"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon direction={header.column.getIsSorted()} />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
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
                  No rows match the current filter.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-3 py-2.5 max-w-0"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-400">
          Page <span className="font-semibold text-gray-600">{pageIndex + 1}</span> of{' '}
          <span className="font-semibold text-gray-600">{pageCount || 1}</span>
          {' '}·{' '}
          <span className="font-semibold text-gray-600">{pageSize}</span> rows/page
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200
                       disabled:opacity-25 disabled:cursor-default transition-colors"
            aria-label="First page"
          >
            <ChevronsLeftIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200
                       disabled:opacity-25 disabled:cursor-default transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200
                       disabled:opacity-25 disabled:cursor-default transition-colors"
            aria-label="Next page"
          >
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200
                       disabled:opacity-25 disabled:cursor-default transition-colors"
            aria-label="Last page"
          >
            <ChevronsRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
