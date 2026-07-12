'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { ElementsPanel } from './ElementsPanel';
import { exportHtml } from './htmlExporter';
import type { CanvasElement, TemplateState, TextElement } from './types';

const INITIAL_STATE: TemplateState = {
  elements: [],
  canvasBackground: '#ffffff',
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
  // Keep history in a ref so callbacks always see the latest value without
  // needing to be recreated on every state change.
  const historyRef = useRef<TemplateState[]>([INITIAL_STATE]);
  const indexRef = useRef(0);

  // A single counter forces re-renders when history changes.
  const [tick, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSymbol, setShowSymbol] = useState(false);

  const state = historyRef.current[indexRef.current] ?? INITIAL_STATE;

  const push = useCallback((next: TemplateState) => {
    const truncated = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current = [...truncated, next];
    indexRef.current = historyRef.current.length - 1;
    rerender();
  }, [rerender]);

  const handleUpdate = useCallback((updated: CanvasElement) => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    push({
      ...cur,
      elements: cur.elements.map((el) => el.id === updated.id ? updated : el),
    });
  }, [push]);

  const handleDelete = useCallback((id: string) => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    push({ ...cur, elements: cur.elements.filter((el) => el.id !== id) });
    setSelectedId(null);
  }, [push]);

  const handleAdd = useCallback((el: CanvasElement) => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    push({ ...cur, elements: [...cur.elements, el] });
  }, [push]);

  const handleUpdateSelected = useCallback((patch: Partial<CanvasElement>) => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    setSelectedId((selId) => {
      if (!selId) return selId;
      push({
        ...cur,
        elements: cur.elements.map((el) =>
          el.id === selId ? { ...el, ...patch } as CanvasElement : el
        ),
      });
      return selId;
    });
  }, [push]);

  const selectedElement = state.elements.find((el) => el.id === selectedId) ?? null;

  const handleInsertDivider = useCallback(() => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    const id = `el-${Date.now()}`;
    handleAdd({
      id, type: 'divider',
      x: 20, y: nextY(cur.elements),
      width: 560, height: 16, color: '#e5e7eb', thickness: 1,
    });
  }, [handleAdd]);

  const handleInsertTable = useCallback((rows: number, cols: number) => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    const id = `el-${Date.now()}`;
    handleAdd({
      id, type: 'table',
      x: 20, y: nextY(cur.elements),
      width: 560, height: rows * 36,
      rows, cols,
      cells: Array.from({ length: rows }, () => Array(cols).fill('') as string[]),
      borderColor: '#d1d5db', borderWidth: 1, fontSize: 13,
    });
    setSelectedId(id);
  }, [handleAdd]);

  const handleUploadImage = useCallback((src: string) => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    const id = `el-${Date.now()}`;
    handleAdd({
      id, type: 'image',
      x: 20, y: nextY(cur.elements),
      width: 200, height: 100, src, alt: 'image',
    });
    setSelectedId(id);
  }, [handleAdd]);

  const handleInsertEmoji = useCallback((em: string) => {
    setSelectedId((selId) => {
      if (!selId) return selId;
      const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
      const el = cur.elements.find((e) => e.id === selId);
      if (!el || el.type !== 'text') return selId;
      const t = el as TextElement;
      push({
        ...cur,
        elements: cur.elements.map((e) =>
          e.id === selId ? { ...t, content: t.content + em } : e
        ),
      });
      return selId;
    });
  }, [push]);

  const handleInsertSymbol = useCallback((sym: string) => {
    setSelectedId((selId) => {
      if (!selId) return selId;
      const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
      const el = cur.elements.find((e) => e.id === selId);
      if (!el || el.type !== 'text') return selId;
      const t = el as TextElement;
      push({
        ...cur,
        elements: cur.elements.map((e) =>
          e.id === selId ? { ...t, content: t.content + sym } : e
        ),
      });
      return selId;
    });
  }, [push]);

  const handleSaveJson = useCallback(() => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    const blob = new Blob([JSON.stringify(cur, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-template-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleLoadJson = useCallback((loaded: TemplateState) => {
    historyRef.current = [loaded];
    indexRef.current = 0;
    setSelectedId(null);
    rerender();
  }, [rerender]);

  const handleApply = useCallback(() => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    onApply(exportHtml(cur));
  }, [onApply]);

  const handleSetBackground = useCallback((color: string) => {
    const cur = historyRef.current[indexRef.current] ?? INITIAL_STATE;
    push({ ...cur, canvasBackground: color });
  }, [push]);

  // Keyboard undo/redo/delete/escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        if (indexRef.current > 0) {
          indexRef.current -= 1;
          rerender();
          e.preventDefault();
        }
        return;
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (indexRef.current < historyRef.current.length - 1) {
          indexRef.current += 1;
          rerender();
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        const isEditing =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable;
        if (!isEditing) {
          setSelectedId((selId) => {
            if (selId) handleDelete(selId);
            return null;
          });
          e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handleDelete, rerender]);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        background: '#f1f5f9',
        fontFamily: 'Inter, Arial, sans-serif',
      }}
    >
      <Toolbar
        state={state}
        selectedElement={selectedElement}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => { if (canUndo) { indexRef.current -= 1; rerender(); } }}
        onRedo={() => { if (canRedo) { indexRef.current += 1; rerender(); } }}
        onUpdateSelected={handleUpdateSelected}
        onInsertDivider={handleInsertDivider}
        onInsertTable={handleInsertTable}
        onSetBackground={handleSetBackground}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
        onClose={onClose}
        onApply={handleApply}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ElementsPanel
          onInsertEmoji={handleInsertEmoji}
          onInsertSymbol={handleInsertSymbol}
          showEmojiPicker={showEmoji}
          showSymbolPicker={showSymbol}
          onToggleEmoji={() => setShowEmoji((v) => !v)}
          onToggleSymbol={() => setShowSymbol((v) => !v)}
          onUploadImage={handleUploadImage}
        />

        <div
          style={{ flex: 1, overflowY: 'auto', padding: 32 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            maxWidth: 600, margin: '0 auto 10px',
          }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
              Email Canvas — 600px wide (email safe)
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {state.elements.length} element{state.elements.length !== 1 ? 's' : ''}
            </span>
          </div>

          <Canvas
            state={state}
            selectedId={selectedId}
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
