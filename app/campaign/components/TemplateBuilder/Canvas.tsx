'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { Trash2Icon, GripIcon, LockIcon } from 'lucide-react';
import type {
  CanvasElement,
  TemplateState,
  ResizeHandle,
  TextElement,
  TableElement,
  ButtonElement,
  ImageElement,
  DividerElement,
  CellStyle,
  BorderStyle,
} from './types';

const MIN_SIZE = 24;

interface CanvasProps {
  state: TemplateState;
  selectedId: string | null;
  isPreview: boolean;
  onSelect: (id: string | null) => void;
  onUpdate: (updated: CanvasElement) => void;
  onDelete: (id: string) => void;
  onAdd: (el: CanvasElement) => void;
}

interface DragState {
  elementId: string;
  startMouseX: number;
  startMouseY: number;
  startElX: number;
  startElY: number;
}

interface ResizeState {
  elementId: string;
  handle: ResizeHandle;
  startMouseX: number;
  startMouseY: number;
  startElX: number;
  startElY: number;
  startW: number;
  startH: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  elementId: string;
  type: 'table' | 'button';
  cellRow?: number;
  cellCol?: number;
}

function getResizeCursor(handle: ResizeHandle): string {
  const map: Record<ResizeHandle, string> = {
    nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize',
    n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
  };
  return map[handle];
}

function ResizeHandles({ onMouseDown }: { onMouseDown: (h: ResizeHandle, e: React.MouseEvent) => void }) {
  const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const pos: Record<ResizeHandle, React.CSSProperties> = {
    nw: { top: -4, left: -4 },
    n:  { top: -4, left: '50%', transform: 'translateX(-50%)' },
    ne: { top: -4, right: -4 },
    e:  { top: '50%', right: -4, transform: 'translateY(-50%)' },
    se: { bottom: -4, right: -4 },
    s:  { bottom: -4, left: '50%', transform: 'translateX(-50%)' },
    sw: { bottom: -4, left: -4 },
    w:  { top: '50%', left: -4, transform: 'translateY(-50%)' },
  };
  return (
    <>
      {handles.map((h) => (
        <div
          key={h}
          onMouseDown={(e) => { e.stopPropagation(); onMouseDown(h, e); }}
          style={{
            position: 'absolute', width: 8, height: 8,
            background: '#0284c7', border: '1px solid #fff',
            borderRadius: 2, cursor: getResizeCursor(h), zIndex: 10, ...pos[h],
          }}
        />
      ))}
    </>
  );
}

function ElementRenderer({
  el, selected, onContentChange, onCellContextMenu,
}: {
  el: CanvasElement;
  selected: boolean;
  onContentChange: (updated: Partial<CanvasElement>) => void;
  onCellContextMenu?: (e: React.MouseEvent, row: number, col: number) => void;
}) {
  if (el.type === 'text') {
    const t = el as TextElement;
    return (
      <div
        contentEditable={selected && !t.locked}
        suppressContentEditableWarning
        onBlur={(e) => onContentChange({ content: e.currentTarget.innerText })}
        style={{
          width: '100%', height: '100%',
          fontSize: t.fontSize, color: t.fontColor,
          fontWeight: t.fontWeight, fontStyle: t.fontStyle,
          textAlign: t.align, padding: t.padding,
          outline: 'none', lineHeight: 1.5,
          fontFamily: 'Arial, sans-serif', boxSizing: 'border-box',
          whiteSpace: 'pre-wrap', cursor: selected ? 'text' : 'default', overflow: 'hidden',
        }}
        dangerouslySetInnerHTML={selected ? undefined : { __html: t.content.replace(/\n/g, '<br/>') }}
      >
        {selected ? t.content : undefined}
      </div>
    );
  }

  if (el.type === 'image') {
    const img = el as ImageElement;
    if (!img.src) {
      return (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f1f5f9', border: '2px dashed #cbd5e1',
          color: '#94a3b8', fontSize: 12, borderRadius: 4,
        }}>
          {img.label ?? 'Image'}
        </div>
      );
    }
    return <img src={img.src} alt={img.alt} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />;
  }

  if (el.type === 'button') {
    const btn = el as ButtonElement;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <a href={btn.href || '#'} style={{
          background: btn.bgColor, color: btn.textColor,
          borderRadius: btn.borderRadius, fontSize: btn.fontSize,
          padding: '8px 20px', textDecoration: 'none',
          fontFamily: 'Arial, sans-serif', fontWeight: 'bold', display: 'inline-block',
        }} onClick={(e) => e.preventDefault()}>
          {btn.label}
        </a>
      </div>
    );
  }

  if (el.type === 'divider') {
    const d = el as DividerElement;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <hr style={{ width: '100%', border: 'none', borderTop: `${d.thickness}px solid ${d.color}`, margin: 0 }} />
      </div>
    );
  }

  if (el.type === 'table') {
    const t = el as TableElement;
    const pad = t.cellPadding ?? 6;
    return (
      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: t.fontSize, fontFamily: 'Arial, sans-serif' }}>
        <tbody>
          {Array.from({ length: t.rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: t.cols }).map((_, c) => {
                const cs: CellStyle = t.cellStyles?.[r]?.[c] ?? {};
                const isHeader = r === 0 && !!t.headerBgColor;
                const bg = cs.bgColor ?? (isHeader ? t.headerBgColor : undefined);
                const bStyle = cs.borderStyle ?? t.borderStyle ?? 'solid';
                const bWidth = cs.borderWidth ?? t.borderWidth;
                const bColor = cs.borderColor ?? t.borderColor;
                return (
                  <td
                    key={c}
                    contentEditable={selected && !t.locked}
                    suppressContentEditableWarning
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onCellContextMenu?.(e, r, c); }}
                    onBlur={(e) => {
                      const newCells = t.cells.map((row) => [...row]);
                      if (!newCells[r]) newCells[r] = [];
                      newCells[r]![c] = e.currentTarget.innerText;
                      onContentChange({ cells: newCells });
                    }}
                    style={{
                      border: `${bWidth}px ${bStyle} ${bColor}`,
                      padding: `${pad}px ${pad + 2}px`,
                      outline: 'none',
                      background: bg,
                      color: cs.textColor,
                      fontWeight: isHeader && !cs.textColor ? 'bold' : undefined,
                      textAlign: cs.align,
                      verticalAlign: cs.verticalAlign,
                    }}
                  >
                    {t.cells[r]?.[c] ?? ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (el.type === 'spacer') {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: selected ? 'rgba(2,132,199,0.06)' : 'transparent',
        border: selected ? '1px dashed #0284c7' : '1px dashed transparent',
        borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#94a3b8', fontSize: 11,
      }}>
        {selected ? 'Spacer' : ''}
      </div>
    );
  }

  return null;
}

// ── Table properties context menu ──────────────────────────────────────────

interface TableContextMenuProps {
  table: TableElement;
  cellRow: number;
  cellCol: number;
  x: number;
  y: number;
  onClose: () => void;
  onUpdate: (patch: Partial<TableElement>) => void;
  onDelete: () => void;
}

const SWATCHES = [
  '#ffffff','#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8',
  '#fef9c3','#fde68a','#fbbf24','#f97316','#ef4444',
  '#dcfce7','#86efac','#4ade80','#16a34a','#166534',
  '#dbeafe','#93c5fd','#3b82f6','#1d4ed8','#1e1b4b',
  '#f5f3ff','#c4b5fd','#8b5cf6','#7c3aed','#111827',
];

function ColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
      {SWATCHES.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            width: 18, height: 18, borderRadius: 3, border: s === value ? '2px solid #0284c7' : '1px solid #d1d5db',
            background: s, cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)}
        style={{ width: 26, height: 22, border: '1px solid #d1d5db', borderRadius: 3, cursor: 'pointer', padding: 1 }} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, padding: '3px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11, fontFamily: 'monospace' }} />
      <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

const ALIGN_GRID: { halign: 'left'|'center'|'right'; valign: 'top'|'middle'|'bottom' }[] = [
  { halign: 'left',   valign: 'top'    },
  { halign: 'center', valign: 'top'    },
  { halign: 'right',  valign: 'top'    },
  { halign: 'left',   valign: 'middle' },
  { halign: 'center', valign: 'middle' },
  { halign: 'right',  valign: 'middle' },
  { halign: 'left',   valign: 'bottom' },
  { halign: 'center', valign: 'bottom' },
  { halign: 'right',  valign: 'bottom' },
];

function AlignIcon({ halign, valign, active }: { halign: string; valign: string; active: boolean }) {
  const size = 14;
  const dotH = halign === 'left' ? 1 : halign === 'center' ? size / 2 - 2 : size - 3;
  const dotV = valign === 'top' ? 1 : valign === 'middle' ? size / 2 - 2 : size - 3;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <rect x={0} y={0} width={size} height={size} fill={active ? '#dbeafe' : '#f8fafc'} rx={2} />
      <rect x={dotH} y={dotV} width={4} height={4} fill={active ? '#1d4ed8' : '#94a3b8'} rx={1} />
    </svg>
  );
}

function getCellStyle(table: TableElement, row: number, col: number): CellStyle {
  return table.cellStyles?.[row]?.[col] ?? {};
}

function setCellStyle(table: TableElement, row: number, col: number, patch: Partial<CellStyle>, scope: 'cell' | 'table'): Partial<TableElement> {
  if (scope === 'table') {
    // apply to table-level defaults (border) or all cells (bg/text/align)
    const field = Object.keys(patch)[0] as keyof CellStyle;
    if (field === 'borderColor') return { borderColor: patch.borderColor! };
    if (field === 'borderWidth') return { borderWidth: patch.borderWidth! };
    if (field === 'borderStyle') return { borderStyle: patch.borderStyle };
    // for bg/text/align: apply to all cells
    const newStyles: CellStyle[][] = Array.from({ length: table.rows }, (_, r) =>
      Array.from({ length: table.cols }, (_, c) => ({ ...(table.cellStyles?.[r]?.[c] ?? {}), ...patch }))
    );
    return { cellStyles: newStyles };
  }
  // cell scope
  const newStyles: CellStyle[][] = Array.from({ length: table.rows }, (_, r) =>
    Array.from({ length: table.cols }, (_, c) =>
      r === row && c === col ? { ...(table.cellStyles?.[r]?.[c] ?? {}), ...patch } : (table.cellStyles?.[r]?.[c] ?? {})
    )
  );
  return { cellStyles: newStyles };
}

function TableContextMenu({ table, cellRow, cellCol, x, y, onClose, onUpdate, onDelete }: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [borderScope, setBorderScope] = useState<'cell' | 'table'>('cell');
  const [bgScope, setBgScope] = useState<'cell' | 'table'>('cell');

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const cs = getCellStyle(table, cellRow, cellCol);

  // current effective values (cell override or table default)
  const bStyle   = cs.borderStyle  ?? table.borderStyle  ?? 'solid';
  const bWidth   = cs.borderWidth  ?? table.borderWidth;
  const bColor   = cs.borderColor  ?? table.borderColor;
  const bgColor  = cs.bgColor      ?? (cellRow === 0 && table.headerBgColor ? table.headerBgColor : '#ffffff');
  const txtColor = cs.textColor    ?? '#111827';
  const hAlign   = cs.align        ?? 'left';
  const vAlign   = cs.verticalAlign ?? 'middle';

  function patchBorder(patch: Partial<CellStyle>) { onUpdate(setCellStyle(table, cellRow, cellCol, patch, borderScope)); }
  function patchBg(patch: Partial<CellStyle>)     { onUpdate(setCellStyle(table, cellRow, cellCol, patch, bgScope)); }
  function patchCell(patch: Partial<CellStyle>)   { onUpdate(setCellStyle(table, cellRow, cellCol, patch, 'cell')); }

  // Row/col operations
  function insertRowAbove() {
    const newRow = Array(table.cols).fill('') as string[];
    const newCells = [...table.cells.slice(0, cellRow), newRow, ...table.cells.slice(cellRow)];
    const newStyles = [...(table.cellStyles ?? []).slice(0, cellRow), Array(table.cols).fill({}) as CellStyle[], ...(table.cellStyles ?? []).slice(cellRow)];
    onUpdate({ rows: table.rows + 1, cells: newCells, cellStyles: newStyles, height: table.height + 32 });
  }
  function insertRowBelow() {
    const newRow = Array(table.cols).fill('') as string[];
    const newCells = [...table.cells.slice(0, cellRow + 1), newRow, ...table.cells.slice(cellRow + 1)];
    const newStyles = [...(table.cellStyles ?? []).slice(0, cellRow + 1), Array(table.cols).fill({}) as CellStyle[], ...(table.cellStyles ?? []).slice(cellRow + 1)];
    onUpdate({ rows: table.rows + 1, cells: newCells, cellStyles: newStyles, height: table.height + 32 });
  }
  function insertColLeft() {
    const newCells = table.cells.map((row) => [...row.slice(0, cellCol), '', ...row.slice(cellCol)]);
    const newStyles = (table.cellStyles ?? []).map((row) => [...row.slice(0, cellCol), {} as CellStyle, ...row.slice(cellCol)]);
    onUpdate({ cols: table.cols + 1, cells: newCells, cellStyles: newStyles, width: table.width + 60 });
  }
  function insertColRight() {
    const newCells = table.cells.map((row) => [...row.slice(0, cellCol + 1), '', ...row.slice(cellCol + 1)]);
    const newStyles = (table.cellStyles ?? []).map((row) => [...row.slice(0, cellCol + 1), {} as CellStyle, ...row.slice(cellCol + 1)]);
    onUpdate({ cols: table.cols + 1, cells: newCells, cellStyles: newStyles, width: table.width + 60 });
  }
  function deleteRow() {
    if (table.rows <= 1) return;
    const newCells = table.cells.filter((_, i) => i !== cellRow);
    const newStyles = (table.cellStyles ?? []).filter((_, i) => i !== cellRow);
    onUpdate({ rows: table.rows - 1, cells: newCells, cellStyles: newStyles, height: Math.max(MIN_SIZE, table.height - 32) });
    onClose();
  }
  function deleteCol() {
    if (table.cols <= 1) return;
    const newCells = table.cells.map((row) => row.filter((_, i) => i !== cellCol));
    const newStyles = (table.cellStyles ?? []).map((row) => row.filter((_, i) => i !== cellCol));
    onUpdate({ cols: table.cols - 1, cells: newCells, cellStyles: newStyles, width: Math.max(MIN_SIZE, table.width - 60) });
    onClose();
  }

  const section = (title: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '10px 0 5px', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
      {title}
    </div>
  );

  const scopeToggle = (scope: 'cell' | 'table', setScope: (s: 'cell' | 'table') => void) => (
    <select value={scope} onChange={(e) => setScope(e.target.value as 'cell' | 'table')}
      style={{ fontSize: 10, padding: '2px 4px', borderRadius: 3, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>
      <option value="cell">This cell</option>
      <option value="table">All cells</option>
    </select>
  );

  const actionBtn = (label: string, icon: string, onClick: () => void, danger = false) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: danger ? '#dc2626' : '#374151', borderRadius: 4, textAlign: 'left' as const }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? '#fef2f2' : '#f1f5f9'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
      <span style={{ fontSize: 13 }}>{icon}</span> {label}
    </button>
  );

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 290),
    top: Math.min(y, window.innerHeight - 600),
    width: 272,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    zIndex: 9000,
    padding: '10px 14px 14px',
    fontFamily: 'Inter, Arial, sans-serif',
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  return (
    <div ref={menuRef} style={menuStyle} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Cell ({cellRow + 1},{cellCol + 1})</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>

      {/* BORDER */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Border</span>
          {scopeToggle(borderScope, setBorderScope)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: '#6b7280', minWidth: 44 }}>Style</span>
          <select value={bStyle} onChange={(e) => patchBorder({ borderStyle: e.target.value as BorderStyle })}
            style={{ flex: 1, padding: '3px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}>
            <option value="solid">solid</option>
            <option value="dashed">dashed</option>
            <option value="dotted">dotted</option>
            <option value="double">double</option>
            <option value="none">none</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: '#6b7280', minWidth: 44 }}>Width</span>
          <input type="range" min={0} max={8} value={bWidth}
            onChange={(e) => patchBorder({ borderWidth: Number(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#374151', minWidth: 24, textAlign: 'right' }}>{bWidth}px</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6b7280', minWidth: 44 }}>Color</span>
          <ColorRow label="" value={bColor} onChange={(v) => patchBorder({ borderColor: v })} />
        </div>
      </div>

      {/* CELL BACKGROUND */}
      {section('Cell Background')}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>Color</span>
        {scopeToggle(bgScope, setBgScope)}
      </div>
      <ColorSwatches value={bgColor} onChange={(v) => patchBg({ bgColor: v })} />
      <ColorRow label="Custom" value={bgColor} onChange={(v) => patchBg({ bgColor: v })} />

      {/* TEXT COLOR */}
      {section('Text Color')}
      <ColorSwatches value={txtColor} onChange={(v) => patchCell({ textColor: v })} />
      <ColorRow label="Custom" value={txtColor} onChange={(v) => patchCell({ textColor: v })} />

      {/* CELL ALIGNMENT */}
      {section('Cell Alignment')}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* 3×3 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 24px)', gap: 3 }}>
          {ALIGN_GRID.map(({ halign, valign }) => {
            const active = halign === hAlign && valign === vAlign;
            return (
              <button key={`${halign}-${valign}`}
                onClick={() => patchCell({ align: halign, verticalAlign: valign })}
                style={{ width: 24, height: 24, border: active ? '1.5px solid #3b82f6' : '1px solid #d1d5db', borderRadius: 4, background: active ? '#eff6ff' : '#f9fafb', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlignIcon halign={halign} valign={valign} active={active} />
              </button>
            );
          })}
        </div>
        {/* vertical-only quick buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(['top','middle','bottom'] as const).map((v) => (
            <button key={v} onClick={() => patchCell({ verticalAlign: v })}
              style={{ width: 24, height: 24, border: vAlign === v ? '1.5px solid #3b82f6' : '1px solid #d1d5db', borderRadius: 4, background: vAlign === v ? '#eff6ff' : '#f9fafb', cursor: 'pointer', padding: 2, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: vAlign === v ? '#1d4ed8' : '#6b7280' }}>
              {v === 'top' ? '↑' : v === 'middle' ? '↕' : '↓'}
            </button>
          ))}
        </div>
      </div>

      {/* ROWS & COLUMNS */}
      {section('Rows & Columns')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {actionBtn('Insert row above', '↑', insertRowAbove)}
        {actionBtn('Insert row below', '↓', insertRowBelow)}
        {actionBtn('Insert column left', '←', insertColLeft)}
        {actionBtn('Insert column right', '→', insertColRight)}
        <div style={{ margin: '4px 0', borderTop: '1px solid #f1f5f9' }} />
        {actionBtn('Delete row', '✕', deleteRow, true)}
        {actionBtn('Delete column', '✕', deleteCol, true)}
        <div style={{ margin: '4px 0', borderTop: '1px solid #f1f5f9' }} />
        {actionBtn('Delete table', '🗑', onDelete, true)}
      </div>
    </div>
  );
}

// ── Button properties context menu ────────────────────────────────────────

interface ButtonContextMenuProps {
  btn: ButtonElement;
  x: number;
  y: number;
  onClose: () => void;
  onUpdate: (patch: Partial<ButtonElement>) => void;
}

function ButtonContextMenu({ btn, x, y, onClose, onUpdate }: ButtonContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const row = (label: string, control: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 80 }}>{label}</span>
      {control}
    </div>
  );

  const colorInput = (val: string, onChange: (v: string) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input type="color" value={val} onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
      <input type="text" value={val} onChange={(e) => onChange(e.target.value)}
        style={{ width: 72, padding: '3px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11, fontFamily: 'monospace' }} />
    </div>
  );

  const numInput = (val: number, min: number, max: number, onChange: (v: number) => void) => (
    <input type="number" value={val} min={min} max={max}
      onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
      style={{ width: 56, padding: '3px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'center' }}
    />
  );

  const section = (title: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 6px' }}>
      {title}
    </div>
  );

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 280),
    top: Math.min(y, window.innerHeight - 380),
    width: 264,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    zIndex: 9000,
    padding: '10px 14px 14px',
    fontFamily: 'Inter, Arial, sans-serif',
  };

  return (
    <div ref={menuRef} style={menuStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Button Properties</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>

      {section('Link')}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Label</div>
        <input
          type="text"
          value={btn.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>URL</div>
        <input
          type="text"
          value={btn.href}
          onChange={(e) => onUpdate({ href: e.target.value })}
          placeholder="https://"
          style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, fontFamily: 'monospace' }}
        />
      </div>

      {section('Colors')}
      {row('Background', colorInput(btn.bgColor, (v) => onUpdate({ bgColor: v })))}
      {row('Text color', colorInput(btn.textColor, (v) => onUpdate({ textColor: v })))}

      {section('Style')}
      {row('Font size', numInput(btn.fontSize, 8, 48, (v) => onUpdate({ fontSize: v })))}
      {row('Border radius', numInput(btn.borderRadius, 0, 50, (v) => onUpdate({ borderRadius: v })))}
    </div>
  );
}


// ── Ruler ────────────────────────────────────────────────────────────────────

function Ruler({ width, gridSize }: { width: number; gridSize: number }) {
  const ticks = [];
  for (let px = 0; px <= width; px += gridSize) {
    const showLabel = px % (gridSize * 5) === 0;
    ticks.push(
      <div key={px} style={{ position: 'absolute', left: px, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 1, height: showLabel ? 8 : 4, background: '#94a3b8' }} />
        {showLabel && (
          <span style={{ fontSize: 8, color: '#94a3b8', marginTop: 1, userSelect: 'none', lineHeight: 1 }}>{px}</span>
        )}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width, height: 16, marginBottom: 2, borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
      {ticks}
    </div>
  );
}

// ── Main Canvas ───────────────────────────────────────────────────────────────

export function Canvas({ state, selectedId, isPreview, onSelect, onUpdate, onDelete, onAdd }: CanvasProps) {
  const { canvasWidth, showGrid, gridSize } = state;
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const snap = useCallback((v: number) =>
    showGrid ? Math.round(v / gridSize) * gridSize : v,
    [showGrid, gridSize]
  );

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (isPreview) return;
      e.stopPropagation();
      onSelect(id);
      const el = state.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      dragRef.current = {
        elementId: id,
        startMouseX: e.clientX, startMouseY: e.clientY,
        startElX: el.x, startElY: el.y,
      };
    },
    [state.elements, onSelect, isPreview]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      const el = state.elements.find((x) => x.id === id);
      if (!el || (el.type !== 'table' && el.type !== 'button') || isPreview) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect(id);
      setContextMenu({ x: e.clientX, y: e.clientY, elementId: id, type: el.type as 'table' | 'button' });
    },
    [state.elements, onSelect, isPreview]
  );

  const handleCellContextMenu = useCallback(
    (id: string) => (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPreview) return;
      onSelect(id);
      setContextMenu({ x: e.clientX, y: e.clientY, elementId: id, type: 'table', cellRow: row, cellCol: col });
    },
    [onSelect, isPreview]
  );

  const handleResizeMouseDown = useCallback(
    (handle: ResizeHandle, e: React.MouseEvent, id: string) => {
      if (isPreview) return;
      const el = state.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      resizeRef.current = {
        elementId: id, handle,
        startMouseX: e.clientX, startMouseY: e.clientY,
        startElX: el.x, startElY: el.y,
        startW: el.width, startH: el.height,
      };
    },
    [state.elements, isPreview]
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragRef.current) {
        const d = dragRef.current;
        const el = state.elements.find((x) => x.id === d.elementId);
        if (!el) return;
        const dx = e.clientX - d.startMouseX;
        const dy = e.clientY - d.startMouseY;
        const newX = snap(Math.max(0, Math.min(d.startElX + dx, canvasWidth - el.width)));
        const newY = snap(Math.max(0, d.startElY + dy));
        onUpdate({ ...el, x: newX, y: newY });
        return;
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const el = state.elements.find((x) => x.id === r.elementId);
        if (!el) return;
        const dx = e.clientX - r.startMouseX;
        const dy = e.clientY - r.startMouseY;
        let { x, y, width: w, height: h } = { x: r.startElX, y: r.startElY, width: r.startW, height: r.startH };
        if (r.handle.includes('e')) w = snap(Math.max(MIN_SIZE, r.startW + dx));
        if (r.handle.includes('s')) h = snap(Math.max(MIN_SIZE, r.startH + dy));
        if (r.handle.includes('w')) { const nw = snap(Math.max(MIN_SIZE, r.startW - dx)); x = snap(r.startElX + (r.startW - nw)); w = nw; }
        if (r.handle.includes('n')) { const nh = snap(Math.max(MIN_SIZE, r.startH - dy)); y = snap(r.startElY + (r.startH - nh)); h = nh; }
        onUpdate({ ...el, x, y, width: w, height: h });
      }
    }
    function onMouseUp() { dragRef.current = null; resizeRef.current = null; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [state.elements, onUpdate, snap, canvasWidth]);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type  = e.dataTransfer.getData('element-type');
      const label = e.dataTransfer.getData('element-label') || '';
      if (!type || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = snap(Math.max(0, Math.min(e.clientX - rect.left, canvasWidth - 160)));
      const y = snap(Math.max(0, e.clientY - rect.top));
      const id = `el-${Date.now()}`;
      let el: CanvasElement;
      switch (type) {
        case 'text':    el = { id, type: 'text',    x, y, width: 400, height: 60,  content: 'Your text here', fontSize: 16, fontColor: '#111827', fontWeight: 'normal', fontStyle: 'normal', align: 'left', padding: 8 }; break;
        case 'image':   el = { id, type: 'image',   x, y, width: 200, height: 120, src: '', alt: label || 'image', label }; break;
        case 'button':  el = { id, type: 'button',  x, y, width: 180, height: 48,  label: 'Click Here', href: 'https://', bgColor: '#0284c7', textColor: '#ffffff', borderRadius: 6, fontSize: 14 }; break;
        case 'divider': el = { id, type: 'divider', x, y, width: canvasWidth - 40, height: 16, color: '#e5e7eb', thickness: 1 }; break;
        case 'table':   el = { id, type: 'table',   x, y, width: 400, height: 120, rows: 3, cols: 3, cells: Array.from({ length: 3 }, () => ['', '', '']), borderColor: '#d1d5db', borderWidth: 1, fontSize: 13, cellPadding: 6 }; break;
        case 'spacer':  el = { id, type: 'spacer',  x, y, width: canvasWidth - 40, height: 32 }; break;
        default: return;
      }
      onAdd(el);
      onSelect(id);
    },
    [onAdd, onSelect, canvasWidth, snap]
  );

  const canvasHeight = Math.max(600, ...state.elements.map((el) => el.y + el.height + 40));

  const gridBg = showGrid && !isPreview
    ? `repeating-linear-gradient(0deg, transparent, transparent ${gridSize - 1}px, rgba(99,179,237,0.22) ${gridSize}px),
       repeating-linear-gradient(90deg, transparent, transparent ${gridSize - 1}px, rgba(99,179,237,0.22) ${gridSize}px)`
    : undefined;

  const bgStyle: React.CSSProperties = {
    position: 'relative', width: canvasWidth, minHeight: canvasHeight,
    background: state.canvasBackground,
    backgroundImage: [
      state.backgroundImage ? `url(${state.backgroundImage})` : '',
      gridBg ?? '',
    ].filter(Boolean).join(', ') || undefined,
    backgroundSize: state.backgroundImage ? 'cover' : undefined,
    backgroundPosition: state.backgroundImage ? 'center' : undefined,
    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
    borderRadius: 8,
    margin: '0 auto',
    userSelect: 'none',
  };

  const contextTable = contextMenu?.type === 'table'
    ? (state.elements.find((e) => e.id === contextMenu.elementId) as TableElement | undefined)
    : null;
  const contextButton = contextMenu?.type === 'button'
    ? (state.elements.find((e) => e.id === contextMenu.elementId) as ButtonElement | undefined)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: canvasWidth, margin: '0 auto' }}>
      {showGrid && !isPreview && <Ruler width={canvasWidth} gridSize={gridSize} />}

      <div
        ref={canvasRef}
        onMouseDown={() => !isPreview && onSelect(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCanvasDrop}
        style={bgStyle}
      >
        {state.elements.length === 0 && !isPreview && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: '40px 60px', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ fontSize: 14, marginBottom: 6 }}>Drag elements from the left panel</p>
              <p style={{ fontSize: 12 }}>or use the toolbar to insert</p>
            </div>
          </div>
        )}

        {state.elements.map((el) => {
          const isSelected = el.id === selectedId && !isPreview;
          return (
            <div
              key={el.id}
              onMouseDown={(e) => handleElementMouseDown(e, el.id)}
              onContextMenu={(e) => handleContextMenu(e, el.id)}
              style={{
                position: 'absolute',
                left: el.x, top: el.y, width: el.width, height: el.height,
                outline: isSelected ? '2px solid #0284c7' : '1px solid transparent',
                outlineOffset: 1,
                cursor: isPreview ? 'default' : el.locked ? 'not-allowed' : 'move',
                boxSizing: 'border-box',
              }}
            >
              <ElementRenderer
                el={el}
                selected={isSelected}
                onContentChange={(patch) => onUpdate({ ...el, ...patch } as CanvasElement)}
                onCellContextMenu={el.type === 'table' && !isPreview ? handleCellContextMenu(el.id) : undefined}
              />

              {isSelected && (
                <>
                  {!el.locked && (
                    <ResizeHandles onMouseDown={(h, e) => handleResizeMouseDown(h, e, el.id)} />
                  )}
                  <button
                    onMouseDown={(e) => { e.stopPropagation(); onDelete(el.id); }}
                    style={{
                      position: 'absolute', top: -28, right: 0,
                      background: '#ef4444', border: 'none', borderRadius: 4,
                      padding: '2px 6px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 3, zIndex: 20,
                    }}
                  >
                    <Trash2Icon style={{ width: 12, height: 12, color: '#fff' }} />
                  </button>
                  <div style={{
                    position: 'absolute', top: -26, left: 0,
                    background: el.locked ? '#f59e0b' : el.type === 'table' ? '#7c3aed' : el.type === 'button' ? '#0284c7' : '#0284c7',
                    color: '#fff', borderRadius: 4, padding: '1px 6px',
                    fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, pointerEvents: 'none',
                  }}>
                    {el.locked
                      ? <LockIcon style={{ width: 10, height: 10 }} />
                      : <GripIcon style={{ width: 10, height: 10 }} />
                    }
                    {el.type}{el.locked ? ' (locked)' : (el.type === 'table' || el.type === 'button') ? ' (right-click for options)' : ''}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Table context menu */}
      {contextMenu && contextTable && (
        <TableContextMenu
          table={contextTable}
          cellRow={contextMenu.cellRow ?? 0}
          cellCol={contextMenu.cellCol ?? 0}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onUpdate={(patch) => {
            onUpdate({ ...contextTable, ...patch } as CanvasElement);
          }}
          onDelete={() => { onDelete(contextTable.id); setContextMenu(null); }}
        />
      )}

      {/* Button context menu */}
      {contextMenu && contextButton && (
        <ButtonContextMenu
          btn={contextButton}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onUpdate={(patch) => {
            onUpdate({ ...contextButton, ...patch } as CanvasElement);
          }}
        />
      )}
    </div>
  );
}
