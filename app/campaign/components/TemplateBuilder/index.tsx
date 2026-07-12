'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { ElementsPanel } from './ElementsPanel';
import { exportHtml } from './htmlExporter';
import type { CanvasElement, TemplateState, TextElement, TrackingScript } from './types';

const INITIAL_STATE: TemplateState = {
  elements: [],
  canvasBackground: '#ffffff',
  canvasWidth: 600,
  showGrid: false,
  gridSize: 20,
  trackingScripts: [],
  backgroundImage: '',
};

interface TemplateBuilderProps {
  onApply: (html: string) => void;
  onClose: () => void;
}

function nextY(elements: CanvasElement[]): number {
  if (elements.length === 0) return 20;
  return Math.max(...elements.map((e) => e.y + e.height)) + 10;
}

export function TemplateBuilder({ onApply, onClose }: TemplateBuilderProps) {
  const historyRef = useRef<TemplateState[]>([INITIAL_STATE]);
  const indexRef = useRef(0);
  const [tick, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSymbol, setShowSymbol] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const state = historyRef.current[indexRef.current] ?? INITIAL_STATE;

  const push = useCallback((next: TemplateState) => {
    const truncated = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current = [...truncated, next];
    indexRef.current = historyRef.current.length - 1;
    rerender();
  }, [rerender]);

  const cur = useCallback(() => historyRef.current[indexRef.current] ?? INITIAL_STATE, []);

  const handleUpdate = useCallback((updated: CanvasElement) => {
    const c = cur();
    push({ ...c, elements: c.elements.map((el) => el.id === updated.id ? updated : el) });
  }, [push, cur]);

  const handleDelete = useCallback((id: string) => {
    const c = cur();
    push({ ...c, elements: c.elements.filter((el) => el.id !== id) });
    setSelectedId(null);
  }, [push, cur]);

  const handleAdd = useCallback((el: CanvasElement) => {
    const c = cur();
    push({ ...c, elements: [...c.elements, el] });
  }, [push, cur]);

  const handleUpdateSelected = useCallback((patch: Partial<CanvasElement>) => {
    setSelectedId((selId) => {
      if (!selId) return selId;
      const c = cur();
      push({ ...c, elements: c.elements.map((el) => el.id === selId ? { ...el, ...patch } as CanvasElement : el) });
      return selId;
    });
  }, [push, cur]);

  const selectedElement = state.elements.find((el) => el.id === selectedId) ?? null;

  // Canvas settings
  const handleSetCanvasWidth = useCallback((w: number) => push({ ...cur(), canvasWidth: w }), [push, cur]);
  const handleToggleGrid = useCallback(() => { const c = cur(); push({ ...c, showGrid: !c.showGrid }); }, [push, cur]);
  const handleSetGridSize = useCallback((n: number) => push({ ...cur(), gridSize: n }), [push, cur]);
  const handleSetBackground = useCallback((color: string) => push({ ...cur(), canvasBackground: color }), [push, cur]);
  const handleSetBackgroundImage = useCallback((src: string) => push({ ...cur(), backgroundImage: src }), [push, cur]);
  const handleUpdateTrackingScripts = useCallback((scripts: TrackingScript[]) => push({ ...cur(), trackingScripts: scripts }), [push, cur]);

  // Element inserts
  const handleInsertDivider = useCallback(() => {
    const c = cur();
    handleAdd({ id: `el-${Date.now()}`, type: 'divider', x: 20, y: nextY(c.elements), width: c.canvasWidth - 40, height: 16, color: '#e5e7eb', thickness: 1 });
  }, [handleAdd, cur]);

  const handleInsertTable = useCallback((rows: number, cols: number) => {
    const c = cur();
    const id = `el-${Date.now()}`;
    handleAdd({ id, type: 'table', x: 20, y: nextY(c.elements), width: c.canvasWidth - 40, height: rows * 36, rows, cols, cells: Array.from({ length: rows }, () => Array(cols).fill('') as string[]), borderColor: '#d1d5db', borderWidth: 1, fontSize: 13 });
    setSelectedId(id);
  }, [handleAdd, cur]);

  const handleUploadImage = useCallback((src: string) => {
    const c = cur();
    const id = `el-${Date.now()}`;
    handleAdd({ id, type: 'image', x: 20, y: nextY(c.elements), width: 200, height: 100, src, alt: 'image' });
    setSelectedId(id);
  }, [handleAdd, cur]);

  const handleInsertEmoji = useCallback((em: string) => {
    setSelectedId((selId) => {
      if (!selId) return selId;
      const c = cur();
      const el = c.elements.find((e) => e.id === selId);
      if (!el || el.type !== 'text') return selId;
      const t = el as TextElement;
      push({ ...c, elements: c.elements.map((e) => e.id === selId ? { ...t, content: t.content + em } : e) });
      return selId;
    });
  }, [push, cur]);

  const handleInsertSymbol = useCallback((sym: string) => {
    setSelectedId((selId) => {
      if (!selId) return selId;
      const c = cur();
      const el = c.elements.find((e) => e.id === selId);
      if (!el || el.type !== 'text') return selId;
      const t = el as TextElement;
      push({ ...c, elements: c.elements.map((e) => e.id === selId ? { ...t, content: t.content + sym } : e) });
      return selId;
    });
  }, [push, cur]);

  // Z-order
  const handleMoveUp = useCallback(() => {
    if (!selectedId) return;
    const c = cur();
    const idx = c.elements.findIndex((e) => e.id === selectedId);
    if (idx < c.elements.length - 1) {
      const els = [...c.elements];
      [els[idx], els[idx + 1]] = [els[idx + 1]!, els[idx]!];
      push({ ...c, elements: els });
    }
  }, [selectedId, push, cur]);

  const handleMoveDown = useCallback(() => {
    if (!selectedId) return;
    const c = cur();
    const idx = c.elements.findIndex((e) => e.id === selectedId);
    if (idx > 0) {
      const els = [...c.elements];
      [els[idx], els[idx - 1]] = [els[idx - 1]!, els[idx]!];
      push({ ...c, elements: els });
    }
  }, [selectedId, push, cur]);

  // Lock
  const handleToggleLock = useCallback(() => {
    if (!selectedId) return;
    const c = cur();
    push({ ...c, elements: c.elements.map((el) => el.id === selectedId ? { ...el, locked: !el.locked } : el) });
  }, [selectedId, push, cur]);

  // Save/load/apply
  const handleSaveJson = useCallback(() => {
    const c = cur();
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `email-template-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [cur]);

  const handleLoadJson = useCallback((loaded: TemplateState) => {
    historyRef.current = [loaded];
    indexRef.current = 0;
    setSelectedId(null);
    rerender();
  }, [rerender]);

  const handleApply = useCallback(() => onApply(exportHtml(cur())), [onApply, cur]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (document.activeElement as HTMLElement)?.isContentEditable;

      if (mod && e.key === 'z' && !e.shiftKey) {
        if (indexRef.current > 0) { indexRef.current--; rerender(); e.preventDefault(); } return;
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (indexRef.current < historyRef.current.length - 1) { indexRef.current++; rerender(); e.preventDefault(); } return;
      }
      if (e.key === 'Escape') { onClose(); return; }
      if (!isEditing && e.key === 'g') {
        const c = cur(); push({ ...c, showGrid: !c.showGrid }); e.preventDefault(); return;
      }
      if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        handleDelete(selectedId); e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handleDelete, selectedId, rerender, push, cur]);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: 'Inter, Arial, sans-serif' }}>
      <Toolbar
        state={state}
        selectedElement={selectedElement}
        canUndo={canUndo}
        canRedo={canRedo}
        isPreview={isPreview}
        onUndo={() => { if (canUndo) { indexRef.current--; rerender(); } }}
        onRedo={() => { if (canRedo) { indexRef.current++; rerender(); } }}
        onUpdateSelected={handleUpdateSelected}
        onInsertDivider={handleInsertDivider}
        onInsertTable={handleInsertTable}
        onSetBackground={handleSetBackground}
        onSetCanvasWidth={handleSetCanvasWidth}
        onToggleGrid={handleToggleGrid}
        onSetGridSize={handleSetGridSize}
        onTogglePreview={() => setIsPreview((v) => !v)}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onToggleLock={handleToggleLock}
        onUpdateTrackingScripts={handleUpdateTrackingScripts}
        onSetBackgroundImage={handleSetBackgroundImage}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
        onClose={onClose}
        onApply={handleApply}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!isPreview && (
          <ElementsPanel
            onInsertEmoji={handleInsertEmoji}
            onInsertSymbol={handleInsertSymbol}
            showEmojiPicker={showEmoji}
            showSymbolPicker={showSymbol}
            onToggleEmoji={() => setShowEmoji((v) => !v)}
            onToggleSymbol={() => setShowSymbol((v) => !v)}
            onUploadImage={handleUploadImage}
          />
        )}

        <div
          style={{ flex: 1, overflowY: 'auto', padding: 32, background: isPreview ? '#e5e7eb' : '#f1f5f9' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          {!isPreview && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: state.canvasWidth, margin: '0 auto 10px' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                Email Canvas — {state.canvasWidth}px wide
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {state.elements.length} element{state.elements.length !== 1 ? 's' : ''}
                {state.trackingScripts.filter((s) => s.enabled).length > 0 && (
                  <span style={{ marginLeft: 8, color: '#7c3aed' }}>
                    · {state.trackingScripts.filter((s) => s.enabled).length} script{state.trackingScripts.filter((s) => s.enabled).length !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
            </div>
          )}

          <Canvas
            state={state}
            selectedId={isPreview ? null : selectedId}
            isPreview={isPreview}
            onSelect={setSelectedId}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />
        </div>
      </div>
    </div>
  );
}
