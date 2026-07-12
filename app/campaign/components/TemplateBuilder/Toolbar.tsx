'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { useRef, useState } from 'react';
import {
  BoldIcon, ItalicIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon,
  Undo2Icon, Redo2Icon, DownloadIcon, UploadIcon, CopyIcon, TableIcon,
  Minus, CheckIcon, PaletteIcon, GridIcon, Code2Icon, EyeIcon, EyeOffIcon,
  LockIcon, UnlockIcon, ArrowUpIcon, ArrowDownIcon, ImageIcon, XIcon,
  PlusIcon, TrashIcon,
} from 'lucide-react';
import type { CanvasElement, TextElement, TableElement, TemplateState, TrackingScript, ScriptType } from './types';
import { exportBodyHtml } from './htmlExporter';
import { parseAndConvertJson } from './importConverter';

const WIDTH_PRESETS = [
  { label: '600px — Email standard', value: 600 },
  { label: '640px — Wide email', value: 640 },
  { label: '480px — Mobile-first', value: 480 },
  { label: '320px — Narrow mobile', value: 320 },
  { label: 'Custom', value: 0 },
];

const SCRIPT_PRESETS: { label: string; type: ScriptType; placeholder: string }[] = [
  { label: 'Google Analytics 4', type: 'ga4', placeholder: 'G-XXXXXXXXXX' },
  { label: 'Google Tag Manager', type: 'gtm', placeholder: 'GTM-XXXXXXX' },
  { label: 'Meta Pixel', type: 'fb_pixel', placeholder: '1234567890' },
  { label: 'Custom Script', type: 'custom', placeholder: '<script>...</script>' },
];

interface ToolbarProps {
  state: TemplateState;
  selectedElement: CanvasElement | null;
  canUndo: boolean;
  canRedo: boolean;
  isPreview: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateSelected: (patch: Partial<CanvasElement>) => void;
  onInsertDivider: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  onSetBackground: (color: string) => void;
  onSetCanvasWidth: (w: number) => void;
  onToggleGrid: () => void;
  onSetGridSize: (n: number) => void;
  onTogglePreview: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleLock: () => void;
  onUpdateTrackingScripts: (scripts: TrackingScript[]) => void;
  onSetBackgroundImage: (src: string) => void;
  onSaveJson: () => void;
  onLoadJson: (state: TemplateState) => void;
  onClose: () => void;
  onApply: () => void;
}

function Tip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        <span style={{ display: 'inline-flex' }}>{children}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content style={{
          background: '#1f2937', color: '#f9fafb', fontSize: 11,
          padding: '4px 8px', borderRadius: 5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 9999, whiteSpace: 'nowrap',
        }} sideOffset={6}>
          {tip}
          <Tooltip.Arrow style={{ fill: '#1f2937' }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function TBtn({ tip, onClick, disabled, active, children }: {
  tip: string; onClick?: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode;
}) {
  return (
    <Tip tip={tip}>
      <button onClick={onClick} disabled={disabled} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 5,
        border: active ? '1px solid #0284c7' : '1px solid transparent',
        background: active ? '#e0f2fe' : 'transparent',
        color: disabled ? '#d1d5db' : active ? '#0284c7' : '#374151',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0, flexShrink: 0, transition: 'background 0.1s',
      }}
        onMouseEnter={(e) => { if (!disabled && !active) (e.currentTarget).style.background = '#f1f5f9'; }}
        onMouseLeave={(e) => { if (!disabled && !active) (e.currentTarget).style.background = 'transparent'; }}
      >
        {children}
      </button>
    </Tip>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 22, background: '#e5e7eb', margin: '0 4px', flexShrink: 0 }} />;
}

export function Toolbar({
  state, selectedElement, canUndo, canRedo, isPreview,
  onUndo, onRedo, onUpdateSelected, onInsertDivider, onInsertTable,
  onSetBackground, onSetCanvasWidth, onToggleGrid, onSetGridSize,
  onTogglePreview, onMoveUp, onMoveDown, onToggleLock,
  onUpdateTrackingScripts, onSetBackgroundImage,
  onSaveJson, onLoadJson, onClose, onApply,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const bgImgRef = useRef<HTMLInputElement>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showScripts, setShowScripts] = useState(false);
  const [addingScript, setAddingScript] = useState(false);
  const [newScriptType, setNewScriptType] = useState<ScriptType>('ga4');
  const [newScriptValue, setNewScriptValue] = useState('');
  const [newScriptName, setNewScriptName] = useState('Google Analytics 4');
  const [customWidth, setCustomWidth] = useState(state.canvasWidth);

  const isText = selectedElement?.type === 'text';
  const isTable = selectedElement?.type === 'table';
  const textEl = isText ? (selectedElement as TextElement) : null;
  const tableEl = isTable ? (selectedElement as TableElement) : null;
  const hasSelected = !!selectedElement;

  const currentPreset = WIDTH_PRESETS.find((p) => p.value === state.canvasWidth);
  const isCustomWidth = !currentPreset || currentPreset.value === 0;

  async function handleCopyHtml() {
    await navigator.clipboard.writeText(exportBodyHtml(state));
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }

  function handlePreviewInBrowser() {
    const w = state.canvasWidth ?? 600;
    const body = exportBodyHtml(state);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Email Preview</title>
  <style>body{margin:0;padding:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;}
  .preview-bar{background:#1e1b4b;color:#c7d2fe;font-size:12px;padding:10px 20px;display:flex;align-items:center;gap:16px;}
  .preview-bar strong{color:#fff;}
  </style>
</head>
<body>
  <div class="preview-bar">
    <strong>Email Preview</strong>
    <span>Canvas width: ${w}px</span>
    <span style="margin-left:auto;opacity:0.7;">Close this tab when done</span>
  </div>
  ${body}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function handleLoadJson(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { onLoadJson(parseAndConvertJson(ev.target?.result as string)); }
      catch { alert('Invalid template JSON file.'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  function handleBgImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSetBackgroundImage(ev.target?.result as string);
    reader.readAsDataURL(f);
    e.target.value = '';
  }

  function addScript() {
    if (!newScriptValue.trim()) return;
    const script: TrackingScript = {
      id: `sc-${Date.now()}`, name: newScriptName,
      type: newScriptType, value: newScriptValue.trim(), enabled: true,
    };
    onUpdateTrackingScripts([...state.trackingScripts, script]);
    setNewScriptValue('');
    setAddingScript(false);
  }

  function toggleScript(id: string) {
    onUpdateTrackingScripts(state.trackingScripts.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  }

  function deleteScript(id: string) {
    onUpdateTrackingScripts(state.trackingScripts.filter((s) => s.id !== id));
  }

  const activeScriptCount = state.trackingScripts.filter((s) => s.enabled).length;

  return (
    <Tooltip.Provider>
      <header style={{
        borderBottom: '1px solid #e5e7eb', background: '#fff',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        padding: '6px 12px', gap: 4, flexShrink: 0, minHeight: 46,
      }}>

        {/* Canvas width preset */}
        <Tip tip="Email canvas width preset">
          <select
            value={isCustomWidth ? 0 : state.canvasWidth}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > 0) onSetCanvasWidth(v);
            }}
            style={{
              height: 28, borderRadius: 5, border: '1px solid #e2e8f0',
              fontSize: 11, padding: '0 6px', background: '#f8fafc',
              color: '#374151', cursor: 'pointer', maxWidth: 160,
            }}
          >
            {WIDTH_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Tip>
        {/* Custom width input */}
        <Tip tip="Custom canvas width (200–900px)">
          <input
            type="number" min={200} max={900}
            value={customWidth}
            onChange={(e) => setCustomWidth(Number(e.target.value))}
            onBlur={() => { if (customWidth >= 200 && customWidth <= 900) onSetCanvasWidth(customWidth); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && customWidth >= 200 && customWidth <= 900) onSetCanvasWidth(customWidth); }}
            style={{
              width: 56, height: 28, borderRadius: 5, border: '1px solid #e2e8f0',
              fontSize: 11, padding: '0 4px', textAlign: 'center',
            }}
          />
        </Tip>

        <Sep />

        {/* File ops */}
        <Tip tip="Upload template JSON">
          <button onClick={() => fileRef.current?.click()} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0',
            background: '#f8fafc', cursor: 'pointer', fontSize: 11, color: '#374151', whiteSpace: 'nowrap',
          }}>
            <UploadIcon style={{ width: 13, height: 13 }} /> JSON
          </button>
        </Tip>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoadJson} />

        <Tip tip="Save template as JSON">
          <button onClick={onSaveJson} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0',
            background: '#f8fafc', cursor: 'pointer', fontSize: 11, color: '#374151', whiteSpace: 'nowrap',
          }}>
            <DownloadIcon style={{ width: 13, height: 13 }} /> Save
          </button>
        </Tip>

        <Tip tip={copyDone ? 'Copied!' : 'Copy email HTML to clipboard'}>
          <button onClick={handleCopyHtml} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 5,
            border: copyDone ? '1px solid #10b981' : '1px solid #e2e8f0',
            background: copyDone ? '#d1fae5' : '#f8fafc',
            cursor: 'pointer', fontSize: 11,
            color: copyDone ? '#059669' : '#374151', whiteSpace: 'nowrap',
          }}>
            {copyDone ? <CheckIcon style={{ width: 13, height: 13 }} /> : <CopyIcon style={{ width: 13, height: 13 }} />}
            {copyDone ? 'Copied!' : 'HTML'}
          </button>
        </Tip>

        <Tip tip="Open rendered email preview in a new browser tab">
          <button onClick={handlePreviewInBrowser} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 5,
            border: '1px solid #818cf8',
            background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)',
            cursor: 'pointer', fontSize: 11,
            color: '#4338ca', whiteSpace: 'nowrap',
          }}>
            <EyeIcon style={{ width: 13, height: 13 }} />
            Preview in browser
          </button>
        </Tip>

        <Sep />

        {/* Background color */}
        <Tip tip="Canvas background color">
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <PaletteIcon style={{ width: 14, height: 14, color: '#6b7280' }} />
            <input type="color" value={state.canvasBackground}
              onChange={(e) => onSetBackground(e.target.value)}
              style={{ width: 22, height: 22, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }} />
          </label>
        </Tip>

        {/* Background image */}
        <Tip tip="Canvas background image">
          <button onClick={() => bgImgRef.current?.click()} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0',
            background: state.backgroundImage ? '#f0fdf4' : '#f8fafc',
            cursor: 'pointer', fontSize: 11,
            color: state.backgroundImage ? '#15803d' : '#374151', whiteSpace: 'nowrap',
          }}>
            <ImageIcon style={{ width: 13, height: 13 }} />
            BG Img
          </button>
        </Tip>
        <input ref={bgImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImage} />
        {state.backgroundImage && (
          <Tip tip="Clear background image">
            <button onClick={() => onSetBackgroundImage('')} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              color: '#9ca3af', fontSize: 11, display: 'flex', alignItems: 'center',
            }}>
              <XIcon style={{ width: 12, height: 12 }} />
            </button>
          </Tip>
        )}

        <Sep />

        {/* Grid toggle */}
        <TBtn tip="Toggle grid & snap (G)" active={state.showGrid} onClick={onToggleGrid}>
          <GridIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        {state.showGrid && (
          <Tip tip="Grid size (px)">
            <input
              type="number" min={5} max={100}
              value={state.gridSize}
              onChange={(e) => onSetGridSize(Number(e.target.value))}
              style={{ width: 44, height: 26, borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11, padding: '0 4px', textAlign: 'center' }}
            />
          </Tip>
        )}

        <Sep />

        {/* Text formatting */}
        <TBtn tip="Bold" disabled={!isText} active={textEl?.fontWeight === 'bold'}
          onClick={() => textEl && onUpdateSelected({ fontWeight: textEl.fontWeight === 'bold' ? 'normal' : 'bold' })}>
          <BoldIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip="Italic" disabled={!isText} active={textEl?.fontStyle === 'italic'}
          onClick={() => textEl && onUpdateSelected({ fontStyle: textEl.fontStyle === 'italic' ? 'normal' : 'italic' })}>
          <ItalicIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <Tip tip="Font size">
          <select disabled={!isText} value={textEl?.fontSize ?? 16}
            onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) })}
            style={{ height: 28, borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11, padding: '0 4px', color: isText ? '#374151' : '#d1d5db', background: '#fff', cursor: isText ? 'pointer' : 'not-allowed' }}>
            {[10,11,12,13,14,15,16,18,20,22,24,28,32,36,40,48].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Tip>
        <Tip tip="Font color">
          <input type="color" disabled={!isText} value={textEl?.fontColor ?? '#111827'}
            onChange={(e) => onUpdateSelected({ fontColor: e.target.value })}
            style={{ width: 26, height: 26, border: '1px solid #e2e8f0', borderRadius: 4, padding: 1, cursor: isText ? 'pointer' : 'not-allowed', opacity: isText ? 1 : 0.4 }} />
        </Tip>
        <TBtn tip="Align left" disabled={!isText} active={textEl?.align === 'left'} onClick={() => onUpdateSelected({ align: 'left' })}>
          <AlignLeftIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip="Align center" disabled={!isText} active={textEl?.align === 'center'} onClick={() => onUpdateSelected({ align: 'center' })}>
          <AlignCenterIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip="Align right" disabled={!isText} active={textEl?.align === 'right'} onClick={() => onUpdateSelected({ align: 'right' })}>
          <AlignRightIcon style={{ width: 14, height: 14 }} />
        </TBtn>

        <Sep />

        {/* Padding */}
        <Tip tip="Text padding (px)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>Pad</span>
            <input type="number" min={0} max={60} disabled={!isText}
              value={textEl?.padding ?? 0}
              onChange={(e) => onUpdateSelected({ padding: Number(e.target.value) })}
              style={{ width: 40, height: 26, borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11, padding: '0 4px', textAlign: 'center', color: isText ? '#374151' : '#d1d5db', cursor: isText ? 'text' : 'not-allowed' }} />
          </div>
        </Tip>

        <Sep />

        {/* Insert */}
        <TBtn tip="Insert divider" onClick={onInsertDivider}>
          <Minus style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip="Insert table" onClick={() => setShowTableDialog(true)}>
          <TableIcon style={{ width: 14, height: 14 }} />
        </TBtn>

        {/* Table props */}
        {isTable && tableEl && (
          <>
            <Tip tip="Table border color">
              <input type="color" value={tableEl.borderColor}
                onChange={(e) => onUpdateSelected({ borderColor: e.target.value })}
                style={{ width: 24, height: 24, border: '1px solid #e2e8f0', borderRadius: 4, padding: 1, cursor: 'pointer' }} />
            </Tip>
            <Tip tip="Table border width (px)">
              <input type="number" min={0} max={8} value={tableEl.borderWidth}
                onChange={(e) => onUpdateSelected({ borderWidth: Number(e.target.value) })}
                style={{ width: 38, height: 26, borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11, padding: '0 4px', textAlign: 'center' }} />
            </Tip>
            <Tip tip="Table font size">
              <select value={tableEl.fontSize} onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) })}
                style={{ height: 26, borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11, padding: '0 4px', background: '#fff' }}>
                {[10,11,12,13,14,15,16,18,20].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Tip>
          </>
        )}

        <Sep />

        {/* Element controls */}
        <TBtn tip="Bring forward" disabled={!hasSelected} onClick={onMoveUp}>
          <ArrowUpIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip="Send backward" disabled={!hasSelected} onClick={onMoveDown}>
          <ArrowDownIcon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip={selectedElement?.locked ? 'Unlock element' : 'Lock element'} disabled={!hasSelected} active={!!selectedElement?.locked} onClick={onToggleLock}>
          {selectedElement?.locked
            ? <LockIcon style={{ width: 14, height: 14 }} />
            : <UnlockIcon style={{ width: 14, height: 14 }} />}
        </TBtn>

        <Sep />

        {/* Tracking scripts */}
        <Tip tip={`Tracking scripts (${activeScriptCount} active)`}>
          <button onClick={() => setShowScripts(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 5,
            border: activeScriptCount > 0 ? '1px solid #7c3aed' : '1px solid #e2e8f0',
            background: activeScriptCount > 0 ? '#f5f3ff' : '#f8fafc',
            cursor: 'pointer', fontSize: 11,
            color: activeScriptCount > 0 ? '#7c3aed' : '#374151', whiteSpace: 'nowrap',
          }}>
            <Code2Icon style={{ width: 13, height: 13 }} />
            Scripts{activeScriptCount > 0 ? ` (${activeScriptCount})` : ''}
          </button>
        </Tip>

        <Sep />

        {/* Undo / Redo */}
        <TBtn tip="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <Undo2Icon style={{ width: 14, height: 14 }} />
        </TBtn>
        <TBtn tip="Redo (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>
          <Redo2Icon style={{ width: 14, height: 14 }} />
        </TBtn>

        {/* Preview toggle */}
        <TBtn tip={isPreview ? 'Exit preview' : 'Preview email'} active={isPreview} onClick={onTogglePreview}>
          {isPreview ? <EyeOffIcon style={{ width: 14, height: 14 }} /> : <EyeIcon style={{ width: 14, height: 14 }} />}
        </TBtn>

        <div style={{ flex: 1 }} />

        <button onClick={onClose} style={{
          padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db',
          background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280',
        }}>
          Cancel
        </button>
        <button onClick={onApply} style={{
          padding: '5px 16px', borderRadius: 6, border: 'none',
          background: '#0284c7', cursor: 'pointer', fontSize: 12,
          color: '#fff', fontWeight: 600, marginLeft: 6,
        }}>
          Apply to Template
        </button>
      </header>

      {/* Insert Table Dialog */}
      {showTableDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Insert Table</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Rows
                <input type="number" min={1} max={20} value={tableRows} onChange={(e) => setTableRows(Number(e.target.value))}
                  style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13 }} />
              </label>
              <label style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Columns
                <input type="number" min={1} max={10} value={tableCols} onChange={(e) => setTableCols(Number(e.target.value))}
                  style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowTableDialog(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>Cancel</button>
              <button onClick={() => { onInsertTable(tableRows, tableCols); setShowTableDialog(false); }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: '#0284c7', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 600 }}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Scripts Modal */}
      {showScripts && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Tracking Scripts</h4>
              <button onClick={() => { setShowScripts(false); setAddingScript(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
                <XIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Script list */}
            {state.trackingScripts.length === 0 && !addingScript && (
              <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No scripts added yet.</p>
            )}
            {state.trackingScripts.map((sc) => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 8, background: sc.enabled ? '#fafafa' : '#f8f9fa' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{sc.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
                    {sc.type === 'custom' ? '(custom snippet)' : sc.value}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: sc.enabled ? '#0284c7' : '#9ca3af' }}>
                  <input type="checkbox" checked={sc.enabled} onChange={() => toggleScript(sc.id)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                  {sc.enabled ? 'On' : 'Off'}
                </label>
                <button onClick={() => deleteScript(sc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                  <TrashIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}

            {/* Add script form */}
            {addingScript ? (
              <div style={{ border: '1px solid #e0e7ff', borderRadius: 8, padding: 16, background: '#f8f7ff', marginTop: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Type
                    <select value={newScriptType} onChange={(e) => {
                      const t = e.target.value as ScriptType;
                      setNewScriptType(t);
                      const preset = SCRIPT_PRESETS.find((p) => p.type === t);
                      if (preset) setNewScriptName(preset.label);
                      setNewScriptValue('');
                    }} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 12 }}>
                      {SCRIPT_PRESETS.map((p) => <option key={p.type} value={p.type}>{p.label}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Name
                    <input value={newScriptName} onChange={(e) => setNewScriptName(e.target.value)}
                      style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 12 }} />
                  </label>
                  <label style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {newScriptType === 'custom' ? 'Script HTML' : 'ID / Value'}
                    {newScriptType === 'custom'
                      ? <textarea value={newScriptValue} onChange={(e) => setNewScriptValue(e.target.value)}
                          placeholder={SCRIPT_PRESETS.find((p) => p.type === newScriptType)?.placeholder}
                          rows={4} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 11, fontFamily: 'monospace', resize: 'vertical' }} />
                      : <input value={newScriptValue} onChange={(e) => setNewScriptValue(e.target.value)}
                          placeholder={SCRIPT_PRESETS.find((p) => p.type === newScriptType)?.placeholder}
                          style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 12 }} />
                    }
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setAddingScript(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>Cancel</button>
                  <button onClick={addScript} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: '#7c3aed', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 600 }}>Add Script</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingScript(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 10,
                padding: '8px 14px', borderRadius: 7, border: '1px dashed #c4b5fd',
                background: '#faf5ff', cursor: 'pointer', fontSize: 12, color: '#7c3aed', fontWeight: 500,
              }}>
                <PlusIcon style={{ width: 14, height: 14 }} /> Add Tracking Script
              </button>
            )}

            <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#0369a1', lineHeight: 1.6 }}>
                Scripts are injected into the <code style={{ fontFamily: 'monospace', background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>&lt;head&gt;</code> of the exported HTML.
                Only enabled scripts are included. Use "Copy HTML" or "Apply to Template" to get the final output.
              </p>
            </div>
          </div>
        </div>
      )}
    </Tooltip.Provider>
  );
}
