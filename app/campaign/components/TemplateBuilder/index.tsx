'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { ElementsPanel } from './ElementsPanel';
import { exportHtml } from './htmlExporter';
import type { CanvasElement, TemplateState, TextElement, TableElement } from './types';

const INITIAL_STATE: TemplateState = {
  elements: [],
  canvasBackground: '#ffffff',
};

interface TemplateBuilderProps {
  onApply: (html: string) => void;
  onClose: () => void;
}

export function TemplateBuilder({ onApply, onClose }: TemplateBuilderProps) {
  const [history, setHistory] = useState<TemplateState[]>([INITIAL_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSymbol, setShowSymbol] = useState(false);

  const state = history[historyIndex]!;

  function push(next: TemplateState) {
    const newHistory = history.slice(0, historyIndex + 1).concat(next);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  const updateElements = useCallback((updater: (els: CanvasElement[]) => CanvasElement[]) => {
    push({ ...state, elements: updater(state.elements) });
  }, [state, historyIndex, history]);

  const handleUpdate = useCallback((updated: CanvasElement) => {
    push({
      ...state,
      elements: state.elements.map((el) => el.id === updated.id ? updated : el),
    });
  }, [state, historyIndex, history]);

  const handleDelete = useCallback((id: string) => {
    push({ ...state, elements: state.elements.filter((el) => el.id !== id) });
    setSelectedId(null);
  }, [state, historyIndex, history]);

  const handleAdd = useCallback((el: CanvasElement) => {
    push({ ...state, elements: [...state.elements, el] });
  }, [state, historyIndex, history]);

  const selectedElement = state.elements.find((el) => el.id === selectedId) ?? null;

  const handleUpdateSelected = useCallback((patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    push({
      ...state,
      elements: state.elements.map((el) => el.id === selectedId ? { ...el, ...patch } as CanvasElement : el),
    });
  }, [selectedId, state, historyIndex, history]);

  function handleInsertDivider() {
    const id = `el-${Date.now()}`;
    handleAdd({
      id, type: 'divider',
      x: 20, y: Math.max(0, ...state.elements.map((e) => e.y + e.height)) + 10,
      width: 560, height: 16, color: '#e5e7eb', thickness: 1,
    });
  }

  function handleInsertTable(rows: number, cols: number) {
    const id = `el-${Date.now()}`;
    handleAdd({
      id, type: 'table',
      x: 20, y: Math.max(0, ...state.elements.map((e) => e.y + e.height)) + 10,
      width: 560, height: rows * 36,
      rows, cols,
      cells: Array.from({ length: rows }, () => Array(cols).fill('')),
      borderColor: '#d1d5db', borderWidth: 1, fontSize: 13,
    });
    setSelectedId(id);
  }

  function handleUploadImage(src: string) {
    const id = `el-${Date.now()}`;
    handleAdd({
      id, type: 'image',
      x: 20, y: Math.max(0, ...state.elements.map((e) => e.y + e.height)) + 10,
      width: 200, height: 100, src, alt: 'image',
    });
    setSelectedId(id);
  }

  function handleInsertEmoji(em: string) {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const t = selectedElement as TextElement;
    handleUpdateSelected({ content: t.content + em });
  }

  function handleInsertSymbol(sym: string) {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const t = selectedElement as TextElement;
    handleUpdateSelected({ content: t.content + sym });
  }

  function handleSaveJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-template-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadJson(loaded: TemplateState) {
    const newHistory = [loaded];
    setHistory(newHistory);
    setHistoryIndex(0);
    setSelectedId(null);
  }

  function handleApply() {
    onApply(exportHtml(state));
  }

  // Keyboard undo/redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey && historyIndex > 0) {
        setHistoryIndex((i) => i - 1);
        e.preventDefault();
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && historyIndex < history.length - 1) {
        setHistoryIndex((i) => i + 1);
        e.preventDefault();
      }
      if (e.key === 'Escape') onClose();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(document.activeElement as HTMLElement)?.isContentEditable) {
          handleDelete(selectedId);
          e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyIndex, history.length, selectedId, handleDelete, onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        background: '#f1f5f9',
        fontFamily: 'Inter, Arial, sans-serif',
      }}
    >
      {/* Toolbar */}
      <Toolbar
        state={state}
        selectedElement={selectedElement}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={() => setHistoryIndex((i) => Math.max(0, i - 1))}
        onRedo={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
        onUpdateSelected={handleUpdateSelected}
        onInsertDivider={handleInsertDivider}
        onInsertTable={handleInsertTable}
        onSetBackground={(color) => push({ ...state, canvasBackground: color })}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
        onClose={onClose}
        onApply={handleApply}
      />

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left elements panel */}
        <ElementsPanel
          onInsertEmoji={handleInsertEmoji}
          onInsertSymbol={handleInsertSymbol}
          showEmojiPicker={showEmoji}
          showSymbolPicker={showSymbol}
          onToggleEmoji={() => setShowEmoji((v) => !v)}
          onToggleSymbol={() => setShowSymbol((v) => !v)}
          onUploadImage={handleUploadImage}
        />

        {/* Canvas area */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: 32 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {/* Canvas title bar */}
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
