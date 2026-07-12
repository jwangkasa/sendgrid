'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Trash2Icon,
  GripIcon,
} from 'lucide-react';
import type {
  CanvasElement,
  TemplateState,
  ResizeHandle,
  TextElement,
  TableElement,
  ButtonElement,
  ImageElement,
  DividerElement,
} from './types';

const CANVAS_WIDTH = 600;
const MIN_SIZE = 24;

interface CanvasProps {
  state: TemplateState;
  selectedId: string | null;
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
            position: 'absolute',
            width: 8,
            height: 8,
            background: '#0284c7',
            border: '1px solid #fff',
            borderRadius: 2,
            cursor: getResizeCursor(h),
            zIndex: 10,
            ...pos[h],
          }}
        />
      ))}
    </>
  );
}

function ElementRenderer({
  el,
  selected,
  onContentChange,
}: {
  el: CanvasElement;
  selected: boolean;
  onContentChange: (updated: Partial<CanvasElement>) => void;
}) {
  if (el.type === 'text') {
    const t = el as TextElement;
    return (
      <div
        contentEditable={selected}
        suppressContentEditableWarning
        onBlur={(e) => onContentChange({ content: e.currentTarget.innerText })}
        style={{
          width: '100%',
          height: '100%',
          fontSize: t.fontSize,
          color: t.fontColor,
          fontWeight: t.fontWeight,
          fontStyle: t.fontStyle,
          textAlign: t.align,
          padding: t.padding,
          outline: 'none',
          lineHeight: 1.5,
          fontFamily: 'Arial, sans-serif',
          boxSizing: 'border-box',
          whiteSpace: 'pre-wrap',
          cursor: selected ? 'text' : 'default',
          overflow: 'hidden',
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
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <a
          href={btn.href || '#'}
          style={{
            background: btn.bgColor,
            color: btn.textColor,
            borderRadius: btn.borderRadius,
            fontSize: btn.fontSize,
            padding: '8px 20px',
            textDecoration: 'none',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            display: 'inline-block',
          }}
          onClick={(e) => e.preventDefault()}
        >
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
    return (
      <table style={{
        width: '100%', height: '100%', borderCollapse: 'collapse',
        fontSize: t.fontSize, fontFamily: 'Arial, sans-serif',
      }}>
        <tbody>
          {Array.from({ length: t.rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: t.cols }).map((_, c) => (
                <td
                  key={c}
                  contentEditable={selected}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newCells = t.cells.map((row) => [...row]);
                    if (!newCells[r]) newCells[r] = [];
                    newCells[r]![c] = e.currentTarget.innerText;
                    onContentChange({ cells: newCells });
                  }}
                  style={{
                    border: `${t.borderWidth}px solid ${t.borderColor}`,
                    padding: '4px 8px',
                    outline: 'none',
                  }}
                >
                  {t.cells[r]?.[c] ?? ''}
                </td>
              ))}
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
        borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#94a3b8', fontSize: 11,
      }}>
        {selected ? 'Spacer' : ''}
      </div>
    );
  }

  return null;
}

export function Canvas({ state, selectedId, onSelect, onUpdate, onDelete, onAdd }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const getElementById = useCallback(
    (id: string) => state.elements.find((e) => e.id === id),
    [state.elements]
  );

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onSelect(id);
      const el = state.elements.find((x) => x.id === id);
      if (!el) return;
      dragRef.current = {
        elementId: id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElX: el.x,
        startElY: el.y,
      };
    },
    [state.elements, onSelect]
  );

  const handleResizeMouseDown = useCallback(
    (handle: ResizeHandle, e: React.MouseEvent, id: string) => {
      const el = state.elements.find((x) => x.id === id);
      if (!el) return;
      resizeRef.current = {
        elementId: id,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElX: el.x,
        startElY: el.y,
        startW: el.width,
        startH: el.height,
      };
    },
    [state.elements]
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragRef.current) {
        const d = dragRef.current;
        const el = state.elements.find((x) => x.id === d.elementId);
        if (!el) return;
        const dx = e.clientX - d.startMouseX;
        const dy = e.clientY - d.startMouseY;
        const newX = Math.max(0, Math.min(d.startElX + dx, CANVAS_WIDTH - el.width));
        const newY = Math.max(0, d.startElY + dy);
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

        if (r.handle.includes('e')) w = Math.max(MIN_SIZE, r.startW + dx);
        if (r.handle.includes('s')) h = Math.max(MIN_SIZE, r.startH + dy);
        if (r.handle.includes('w')) {
          const nw = Math.max(MIN_SIZE, r.startW - dx);
          x = r.startElX + (r.startW - nw);
          w = nw;
        }
        if (r.handle.includes('n')) {
          const nh = Math.max(MIN_SIZE, r.startH - dy);
          y = r.startElY + (r.startH - nh);
          h = nh;
        }
        onUpdate({ ...el, x, y, width: w, height: h });
      }
    }

    function onMouseUp() {
      dragRef.current = null;
      resizeRef.current = null;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [state.elements, onUpdate]);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('element-type');
      const label = e.dataTransfer.getData('element-label') || '';
      if (!type || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, CANVAS_WIDTH - 160));
      const y = Math.max(0, e.clientY - rect.top);
      const id = `el-${Date.now()}`;

      let el: CanvasElement;
      switch (type) {
        case 'text':
          el = { id, type: 'text', x, y, width: 400, height: 60, content: 'Your text here', fontSize: 16, fontColor: '#111827', fontWeight: 'normal', fontStyle: 'normal', align: 'left', padding: 8 };
          break;
        case 'image':
          el = { id, type: 'image', x, y, width: 200, height: 120, src: '', alt: label || 'image', label };
          break;
        case 'button':
          el = { id, type: 'button', x, y, width: 180, height: 48, label: 'Click Here', href: 'https://', bgColor: '#0284c7', textColor: '#ffffff', borderRadius: 6, fontSize: 14 };
          break;
        case 'divider':
          el = { id, type: 'divider', x, y, width: CANVAS_WIDTH - 40, height: 16, color: '#e5e7eb', thickness: 1 };
          break;
        case 'table':
          el = { id, type: 'table', x, y, width: 400, height: 120, rows: 3, cols: 3, cells: Array.from({ length: 3 }, () => ['', '', '']), borderColor: '#d1d5db', borderWidth: 1, fontSize: 13 };
          break;
        case 'spacer':
          el = { id, type: 'spacer', x, y, width: CANVAS_WIDTH - 40, height: 32 };
          break;
        default:
          return;
      }
      onAdd(el);
      onSelect(id);
    },
    [onAdd, onSelect]
  );

  const canvasHeight = Math.max(
    600,
    ...state.elements.map((el) => el.y + el.height + 40)
  );

  return (
    <div
      ref={canvasRef}
      onMouseDown={() => onSelect(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
      style={{
        position: 'relative',
        width: CANVAS_WIDTH,
        minHeight: canvasHeight,
        background: state.canvasBackground,
        boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        borderRadius: 8,
        margin: '0 auto',
        userSelect: 'none',
      }}
    >
      {state.elements.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            border: '2px dashed #cbd5e1', borderRadius: 12, padding: '40px 60px',
            textAlign: 'center', color: '#94a3b8',
          }}>
            <p style={{ fontSize: 14, marginBottom: 6 }}>Drag elements from the left panel</p>
            <p style={{ fontSize: 12 }}>or use the toolbar to insert</p>
          </div>
        </div>
      )}

      {state.elements.map((el) => {
        const isSelected = el.id === selectedId;
        return (
          <div
            key={el.id}
            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              outline: isSelected ? '2px solid #0284c7' : '1px solid transparent',
              outlineOffset: 1,
              cursor: 'move',
              boxSizing: 'border-box',
            }}
          >
            <ElementRenderer
              el={el}
              selected={isSelected}
              onContentChange={(patch) => onUpdate({ ...el, ...patch } as CanvasElement)}
            />

            {isSelected && (
              <>
                <ResizeHandles
                  onMouseDown={(h, e) => handleResizeMouseDown(h, e, el.id)}
                />
                {/* Delete button */}
                <button
                  onMouseDown={(e) => { e.stopPropagation(); onDelete(el.id); }}
                  style={{
                    position: 'absolute',
                    top: -28,
                    right: 0,
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    zIndex: 20,
                  }}
                >
                  <Trash2Icon style={{ width: 12, height: 12, color: '#fff' }} />
                </button>
                {/* Drag handle label */}
                <div style={{
                  position: 'absolute',
                  top: -26,
                  left: 0,
                  background: '#0284c7',
                  color: '#fff',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  pointerEvents: 'none',
                }}>
                  <GripIcon style={{ width: 10, height: 10 }} />
                  {el.type}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
