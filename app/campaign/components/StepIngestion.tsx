'use client';

import { useCallback, useRef, useState } from 'react';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import type { RecipientRow } from '@/lib/types';
import {
  UploadCloudIcon,
  FileSpreadsheetIcon,
  XCircleIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
} from 'lucide-react';

// Columns that MUST be present in the sheet (case-insensitive match)
const REQUIRED_COLUMNS: (keyof RecipientRow)[] = [
  'EMAIL_ADDRESS',
];

const OPTIONAL_COLUMNS: (keyof RecipientRow)[] = [
  'FIRST_NAME',
  'LAST_NAME',
  'CATEGORY',
  'COMPANY',
  'PHONE_NUMBER',
  'COMMENTS',
];

const ALL_KNOWN_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

interface ParseResult {
  rows: RecipientRow[];
  warnings: string[];
}

function normaliseHeader(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '_');
}

function parseSheet(buffer: ArrayBuffer, fileName: string): ParseResult {
  const workbook  = xlsxRead(buffer, { type: 'array', cellText: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The workbook contains no sheets.');

  const sheet = workbook.Sheets[sheetName]!;
  const rawRows: Record<string, unknown>[] = xlsxUtils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) throw new Error('The sheet is empty — no data rows found.');

  // Normalise all header keys
  const normalised: Record<string, string>[] = rawRows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[normaliseHeader(k)] = String(v ?? '').trim();
    }
    return out;
  });

  // Validate required columns exist
  const firstRow = normalised[0]!;
  const missingRequired = REQUIRED_COLUMNS.filter((col) => !(col in firstRow));
  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required columns: ${missingRequired.join(', ')}. ` +
      `Found columns: ${Object.keys(firstRow).join(', ')}`
    );
  }

  const warnings: string[] = [];

  // Warn about missing optional columns
  const missingOptional = OPTIONAL_COLUMNS.filter((col) => !(col in firstRow));
  if (missingOptional.length > 0) {
    warnings.push(`Optional columns not found (will default to empty): ${missingOptional.join(', ')}`);
  }

  // Filter out rows with no email address
  const validRows = normalised.filter((row) => {
    const email = row['EMAIL_ADDRESS'] ?? '';
    return email.length > 0 && email.includes('@');
  });

  const skipped = normalised.length - validRows.length;
  if (skipped > 0) {
    warnings.push(`${skipped} row(s) skipped — missing or invalid EMAIL_ADDRESS.`);
  }

  if (validRows.length === 0) {
    throw new Error('No valid rows with an EMAIL_ADDRESS found after filtering.');
  }

  const rows: RecipientRow[] = validRows.map((row) => {
    const mapped: RecipientRow = {
      FIRST_NAME:    row['FIRST_NAME']    ?? '',
      LAST_NAME:     row['LAST_NAME']     ?? '',
      EMAIL_ADDRESS: row['EMAIL_ADDRESS'] ?? '',
      CATEGORY:      row['CATEGORY']      ?? '',
      COMPANY:       row['COMPANY']       ?? '',
      PHONE_NUMBER:  row['PHONE_NUMBER']  ?? '',
      COMMENTS:      row['COMMENTS']      ?? '',
    };
    // Preserve any extra columns
    for (const [k, v] of Object.entries(row)) {
      if (!ALL_KNOWN_COLUMNS.includes(k as keyof RecipientRow)) {
        mapped[k] = v;
      }
    }
    return mapped;
  });

  return { rows, warnings };
}

interface StepIngestionProps {
  onComplete: (rows: RecipientRow[], fileName: string) => void;
}

export function StepIngestion({ onComplete }: StepIngestionProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging]     = useState(false);
  const [parsing, setParsing]           = useState(false);
  const [parseError, setParseError]     = useState<string | null>(null);
  const [warnings, setWarnings]         = useState<string[]>([]);
  const [preview, setPreview]           = useState<{ rows: RecipientRow[]; fileName: string } | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError('Unsupported file type. Please upload an .xlsx, .xls, or .csv file.');
      return;
    }

    setParsing(true);
    setParseError(null);
    setWarnings([]);
    setPreview(null);

    try {
      const buffer = await file.arrayBuffer();
      const { rows, warnings: w } = parseSheet(buffer, file.name);
      setWarnings(w);
      setPreview({ rows, fileName: file.name });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [processFile]
  );

  const handleClear = () => {
    setPreview(null);
    setWarnings([]);
    setParseError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="panel p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Upload Recipient List</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Drop an <code className="text-brand-600">.xlsx</code> file. Required column:{' '}
            <code className="text-brand-600">EMAIL_ADDRESS</code>.
          </p>
        </div>

        {/* Drop zone */}
        {!preview && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              relative flex flex-col items-center justify-center gap-4
              rounded-xl border-2 border-dashed p-12 cursor-pointer
              transition-all duration-200
              ${isDragging
                ? 'border-brand-400 bg-brand-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              className="sr-only"
              aria-label="Upload spreadsheet file"
            />

            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors
              ${isDragging ? 'bg-brand-100' : 'bg-gray-100'}`}
            >
              <UploadCloudIcon
                className={`w-7 h-7 transition-colors ${isDragging ? 'text-brand-500' : 'text-gray-400'}`}
              />
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {parsing ? 'Parsing file…' : 'Drop file here or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv — max 50,000 rows</p>
            </div>

            {parsing && (
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        )}

        {/* Error state */}
        {parseError && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
            <AlertCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Parse error</p>
              <p className="text-xs text-red-500 mt-0.5">{parseError}</p>
            </div>
            <button onClick={() => setParseError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircleIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Parsed preview */}
        {preview && (
          <div className="flex flex-col gap-4 animate-slide-up">
            {/* File info row */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
                  <FileSpreadsheetIcon className="w-4 h-4 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{preview.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {preview.rows.length.toLocaleString()} valid recipients loaded
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2Icon className="w-5 h-5 text-emerald-500" />
                <button
                  onClick={handleClear}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Replace
                </button>
              </div>
            </div>

            {/* Column mapping summary */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Detected columns</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(preview.rows[0] ?? {}).map((col) => (
                  <span
                    key={col}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono
                      ${REQUIRED_COLUMNS.includes(col as keyof RecipientRow)
                        ? 'bg-brand-50 border border-brand-200 text-brand-700'
                        : 'bg-gray-100 border border-gray-200 text-gray-500'
                      }`}
                  >
                    {col}
                    {REQUIRED_COLUMNS.includes(col as keyof RecipientRow) && (
                      <CheckCircle2Icon className="w-2.5 h-2.5 ml-1 text-brand-500" />
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Inline data preview table (first 5 rows) */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['FIRST_NAME', 'LAST_NAME', 'EMAIL_ADDRESS', 'COMPANY', 'CATEGORY'].map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      {['FIRST_NAME', 'LAST_NAME', 'EMAIL_ADDRESS', 'COMPANY', 'CATEGORY'].map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 text-gray-700 max-w-[160px] truncate"
                          title={row[col] ?? ''}
                        >
                          {row[col] || <span className="text-gray-300 italic">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 5 && (
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs text-gray-400">
                    + {(preview.rows.length - 5).toLocaleString()} more rows
                  </p>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => onComplete(preview.rows, preview.fileName)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                           bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium
                           transition-colors duration-150 shadow-sm"
              >
                Continue to Template
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
