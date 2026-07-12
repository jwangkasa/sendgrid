'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { useRef, useState } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  Undo2Icon,
  Redo2Icon,
  DownloadIcon,
  UploadIcon,
  CopyIcon,
  TableIcon,
  Minus,
  CheckIcon,
  PaletteIcon,
} from 'lucide-react';
import type { CanvasElement, TextElement, TableElement, TemplateState } from './types';
import { exportHtml } from './htmlExporter';

interface ToolbarProps {
  state: TemplateState;
  selectedElement: CanvasElement | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateSelected: (patch: Partial<CanvasElement>) => void;
  onInsertDivider: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  onSetBackground: (color: string) => void;
  onSaveJson: () => void;
  onLoadJson: (state: TemplateState) => void;
  onClose: () => void;
  onApply: () => void;
}

function Tip({ tip, children, disabled }: { tip: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        <span style={{ display: 'inline-flex' }}>{children}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          style={{
            background: '#1f2937',
            color: '#f9fafb',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 9999,
            whiteSpace: 'nowrap',
          }}
          sideOffset={6}
        >
          {tip}
          <Tooltip.Arrow style={{ fill: '#1f2937' }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function TBtn({
  tip, onClick, disabled, active, children,
}: {
  tip: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tip tip={tip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: 5,
          border: active ? '1px solid #0284c7' : '1px solid transparent',
          background: active ? '#e0f2fe' : 'transparent',
          color: disabled ? '#d1d5db' : active ? '#0284c7' : '#374151',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          flexShrink: 0,
          transition: 'background 0.1s, border-color 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !active) (e.currentTarget).style.background = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          if (!disabled && !active) (e.currentTarget).style.background = 'transparent';
        }}
      >
        {children}
      </button>
    </Tip>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: '#e5e7eb', margin: '0 4px', flexShrink: 0 }} />;
}

export function Toolbar({
  state,
  selectedElement,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpdateSelected,
  onInsertDivider,
  onInsertTable,
  onSetBackground,
  onSaveJson,
  onLoadJson,
  onClose,
  onApply,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const isText = selectedElement?.type === 'text';
  const isTable = selectedElement?.type === 'table';
  const textEl = isText ? (selectedElement as TextElement) : null;
  const tableEl = isTable ? (selectedElement as TableElement) : null;

  async function handleCopyHtml() {
    const html = exportHtml(state);
    await navigator.clipboard.writeText(html);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }

  function handleLoadJson(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as TemplateState;
        onLoadJson(parsed);
      } catch {
        alert('Invalid template JSON file.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  return (
    <Tooltip.Provider>
      <header style={{
        height: 50,
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 4,
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {/* File ops */}
        <Tip tip="Upload template JSON">
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5, border: '1px solid #e2e8f0',
              background: '#f8fafc', cursor: 'pointer', fontSize: 11,
              color: '#374151', whiteSpace: 'nowrap',
            }}
          >
            <UploadIcon style={{ width: 13, height: 13 }} />
            Upload JSON
          </button>
        </Tip>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoadJson} />

        <Tip tip="Save template as JSON">
          <button
            onClick={onSaveJson}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5, border: '1px solid #e2e8f0',
              background: '#f8fafc', cursor: 'pointer', fontSize: 11,
              color: '#374151', whiteSpace: 'nowrap',
            }}
          >
            <DownloadIcon style={{ width: 13, height: 13 }} />
            Save JSON
          </button>
        </Tip>

        <Tip tip={copyDone ? 'Copied!' : 'Copy email HTML to clipboard'}>
          <button
            onClick={handleCopyHtml}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5,
              border: copyDone ? '1px solid #10b981' : '1px solid #e2e8f0',
              background: copyDone ? '#d1fae5' : '#f8fafc',
              cursor: 'pointer', fontSize: 11,
              color: copyDone ? '#059669' : '#374151', whiteSpace: 'nowrap',
            }}
          >
            {copyDone ? <CheckIcon style={{ width: 13, height: 13 }} /> : <CopyIcon style={{ width: 13, height: 13 }} />}
            {copyDone ? 'Copied!' : 'Copy HTML'}
          </button>
        </Tip>

        <Divider />

        {/* Background color */}
        <Tip tip="Canvas background color">
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <PaletteIcon style={{ width: 14, height: 14, color: '#6b7280' }} />
            <input
              type="color"
              value={state.canvasBackground}
              onChange={(e) => onSetBackground(e.target.value)}
              style={{ width: 22, height: 22, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
            />
          </label>
        </Tip>

        <Divider />

        {/* Text formatting */}
        <TBtn
          tip="Bold (applies to selected text block)"
          disabled={!isText}
          active={textEl?.fontWeight === 'bold'}
          onClick={() => textEl && onUpdateSelected({ fontWeight: textEl.fontWeight === 'bold' ? 'normal' : 'bold' })}
        >
          <BoldIcon style={{ width: 14, height: 14 }} />
        </TBtn>

        <TBtn
          tip="Italic (applies to selected text block)"
          disabled={!isText}
          active={textEl?.fontStyle === 'italic'}
          onClick={() => textEl && onUpdateSelected({ fontStyle: textEl.fontStyle === 'italic' ? 'normal' : 'italic' })}
        >
          <ItalicIcon style={{ width: 14, height: 14 }} />
        </TBtn>

        <Tip tip="Font size">
          <select
            disabled={!isText}
            value={textEl?.fontSize ?? 16}
            onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) })}
            style={{
              height: 28, borderRadius: 5, border: '1px solid #e2e8f0',
              fontSize: 11, padding: '0 4px', color: isText ? '#374151' : '#d1d5db',
              background: '#fff', cursor: isText ? 'pointer' : 'not-allowed',
            }}
          >
            {[10,11,12,13,14,15,16,18,20,22,24,28,32,36,40,48].map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
        </Tip>

        <Tip tip="Font color">
          <input
            type="color"
            disabled={!isText}
            value={textEl?.fontColor ?? '#111827'}
            onChange={(e) => onUpdateSelected({ fontColor: e.target.value })}
            style={{
              width: 26, height: 26, border: '1px solid #e2e8f0', borderRadius: 4,
              padding: 1, cursor: isText ? 'pointer' : 'not-allowed',
              opacity: isText ? 1 : 0.4,
            }}
          />
        </Tip>

        <TBtn
          tip="Align left"
          disabled={!isText}
          active={textEl?.align === 'left'}
          onClick={() => onUpdateSelected({ align: 'left' })}
        >
          <AlignLeftIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn
          tip="Align center"
          disabled={!isText}
          active={textEl?.align === 'center'}
          onClick={() => onUpdateSelected({ align: 'center' })}
        >
          <AlignCenterIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn
          tip="Align right"
          disabled={!isText}
          active={textEl?.align === 'right'}
          onClick={() => onUpdateSelected({ align: 'right' })}
        >
          <AlignRightIcon style={{ width: 14, height: 14 }} />
        </TBtn>

        <Divider />

        {/* Padding */}
        <Tip tip="Padding (px) for selected element">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>Pad</span>
            <input
              type="number"
              min={0}
              max={60}
              disabled={!isText}
              value={textEl?.padding ?? 0}
              onChange={(e) => onUpdateSelected({ padding: Number(e.target.value) })}
              style={{
                width: 46, height: 26, borderRadius: 5, border: '1px solid #e2e8f0',
                fontSize: 11, padding: '0 4px', textAlign: 'center',
                color: isText ? '#374151' : '#d1d5db',
                cursor: isText ? 'text' : 'not-allowed',
              }}
            />
          </div>
        </Tip>

        <Divider />

        {/* Insert divider */}
        <TBtn tip="Insert horizontal divider line" onClick={onInsertDivider}>
          <Minus style={{ width: 14, height: 14 }} />
        </TBtn>

        {/* Insert table */}
        <TBtn tip="Insert table" onClick={() => setShowTableDialog(true)}>
          <TableIcon style={{ width: 14, height: 14 }} />
        </TBtn>

        {/* Table properties (border) */}
        {isTable && tableEl && (
          <>
            <Tip tip="Table border color">
              <input
                type="color"
                value={tableEl.borderColor}
                onChange={(e) => onUpdateSelected({ borderColor: e.target.value })}
                style={{ width: 24, height: 24, border: '1px solid #e2e8f0', borderRadius: 4, padding: 1, cursor: 'pointer' }}
              />
            </Tip>
            <Tip tip="Table border width (px)">
              <input
                type="number"
                min={0}
                max={8}
                value={tableEl.borderWidth}
                onChange={(e) => onUpdateSelected({ borderWidth: Number(e.target.value) })}
                style={{ width: 40, height: 26, borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11, padding: '0 4px', textAlign: 'center' }}
              />
            </Tip>
            <Tip tip="Table font size">
              <select
                value={tableEl.fontSize}
                onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) })}
                style={{ height: 26, borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11, padding: '0 4px', background: '#fff' }}
              >
                {[10,11,12,13,14,15,16,18,20].map((s) => <option key={s} value={s}>{s}px</option>)}
              </select>
            </Tip>
          </>
        )}

        <Divider />

        {/* Undo / Redo */}
        <TBtn tip="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <Undo2Icon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
          <Redo2Icon style={{ width: 14, height: 14 }} />
        </TBtn>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Cancel / Apply */}
        <button
          onClick={onClose}
          style={{
            padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db',
            background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          style={{
            padding: '5px 16px', borderRadius: 6, border: 'none',
            background: '#0284c7', cursor: 'pointer', fontSize: 12,
            color: '#fff', fontWeight: 600, marginLeft: 6,
          }}
        >
          Apply to Template
        </button>
      </header>

      {/* Insert Table Dialog */}
      {showTableDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 10, padding: 24, width: 260,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Insert Table</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Rows
                <input
                  type="number" min={1} max={20} value={tableRows}
                  onChange={(e) => setTableRows(Number(e.target.value))}
                  style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Columns
                <input
                  type="number" min={1} max={10} value={tableCols}
                  onChange={(e) => setTableCols(Number(e.target.value))}
                  style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowTableDialog(false)}
                style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onInsertTable(tableRows, tableCols);
                  setShowTableDialog(false);
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: '#0284c7', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 600 }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </Tooltip.Provider>
  );
}
