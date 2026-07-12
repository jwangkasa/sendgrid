'use client';

import { useRef } from 'react';
import {
  TypeIcon,
  ImageIcon,
  MousePointerIcon,
  Minus,
  TableIcon,
  SpaceIcon,
  SmileIcon,
  HashIcon,
  LayoutTemplateIcon,
} from 'lucide-react';

interface PaletteItem {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PALETTE: PaletteItem[] = [
  { type: 'image', label: 'Upload Logo',        icon: <LayoutTemplateIcon className="w-4 h-4" />, description: 'Company logo image' },
  { type: 'image', label: 'Upload Header',       icon: <ImageIcon className="w-4 h-4" />,          description: 'Full-width header image' },
  { type: 'text',  label: 'Text Block',          icon: <TypeIcon className="w-4 h-4" />,            description: 'Editable text paragraph' },
  { type: 'image', label: 'Image',               icon: <ImageIcon className="w-4 h-4" />,           description: 'Generic image' },
  { type: 'button', label: 'Button / Link',      icon: <MousePointerIcon className="w-4 h-4" />, description: 'Clickable call-to-action button' },
  { type: 'divider', label: 'Divider',           icon: <Minus className="w-4 h-4" />,               description: 'Horizontal rule separator' },
  { type: 'table', label: 'Table',               icon: <TableIcon className="w-4 h-4" />,           description: 'Data table with rows & columns' },
  { type: 'spacer', label: 'Spacer',             icon: <SpaceIcon className="w-4 h-4" />,           description: 'Vertical whitespace block' },
];

const EMOJI_SAMPLES = ['😊','🎉','🚀','💡','📧','✅','⭐','🔥','👋','🎯','💼','📢'];
const SYMBOL_SAMPLES = ['©','®','™','→','←','↑','↓','•','◆','▸','★','♦','§','†','‡'];

interface ElementsPanelProps {
  onInsertEmoji: (emoji: string) => void;
  onInsertSymbol: (sym: string) => void;
  showEmojiPicker: boolean;
  showSymbolPicker: boolean;
  onToggleEmoji: () => void;
  onToggleSymbol: () => void;
  onUploadImage: (label: string) => void;
}

export function ElementsPanel({
  onInsertEmoji,
  onInsertSymbol,
  showEmojiPicker,
  showSymbolPicker,
  onToggleEmoji,
  onToggleSymbol,
  onUploadImage,
}: ElementsPanelProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  function handleDragStart(e: React.DragEvent, type: string, label: string) {
    e.dataTransfer.setData('element-type', type);
    e.dataTransfer.setData('element-label', label);
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <aside style={{
      width: 200,
      flexShrink: 0,
      borderRight: '1px solid #e5e7eb',
      background: '#f8fafc',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Elements
        </p>
      </div>

      <div style={{ padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {PALETTE.map((item) => {
          const isLogoUpload = item.label === 'Upload Logo';
          const isHeaderUpload = item.label === 'Upload Header';
          const needsUpload = isLogoUpload || isHeaderUpload;

          return (
            <div key={item.label}>
              {/* Hidden file inputs for upload items */}
              {isLogoUpload && (
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => onUploadImage(ev.target?.result as string);
                    reader.readAsDataURL(f);
                    e.target.value = '';
                  }}
                />
              )}
              {isHeaderUpload && (
                <input
                  ref={headerInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => onUploadImage(ev.target?.result as string);
                    reader.readAsDataURL(f);
                    e.target.value = '';
                  }}
                />
              )}

              <div
                draggable
                onDragStart={(e) => handleDragStart(e, item.type, item.label)}
                onClick={needsUpload ? () => {
                  if (isLogoUpload) logoInputRef.current?.click();
                  else headerInputRef.current?.click();
                } : undefined}
                title={item.description}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'grab',
                  fontSize: 12,
                  color: '#374151',
                  userSelect: 'none',
                  transition: 'background 0.12s, border-color 0.12s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#f0f9ff';
                  (e.currentTarget as HTMLElement).style.borderColor = '#7dd3fc';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#fff';
                  (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                }}
              >
                <span style={{ color: '#0284c7', flexShrink: 0 }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}

        {/* Emoji picker toggle */}
        <div style={{ marginTop: 4, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
          <button
            onClick={onToggleEmoji}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '7px 10px', borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: showEmojiPicker ? '#f0f9ff' : '#fff',
              cursor: 'pointer', fontSize: 12, color: '#374151',
            }}
          >
            <SmileIcon style={{ width: 16, height: 16, color: '#0284c7', flexShrink: 0 }} />
            Emoji
          </button>
          {showEmojiPicker && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 4px',
              background: '#f8fafc', borderRadius: 6, marginTop: 4,
            }}>
              {EMOJI_SAMPLES.map((em) => (
                <button
                  key={em}
                  onClick={() => onInsertEmoji(em)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, padding: 2, borderRadius: 4,
                    lineHeight: 1,
                  }}
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {/* Symbol picker toggle */}
          <button
            onClick={onToggleSymbol}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '7px 10px', borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: showSymbolPicker ? '#f0f9ff' : '#fff',
              cursor: 'pointer', fontSize: 12, color: '#374151',
              marginTop: 4,
            }}
          >
            <HashIcon style={{ width: 16, height: 16, color: '#0284c7', flexShrink: 0 }} />
            Symbols
          </button>
          {showSymbolPicker && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 4px',
              background: '#f8fafc', borderRadius: 6, marginTop: 4,
            }}>
              {SYMBOL_SAMPLES.map((sym) => (
                <button
                  key={sym}
                  onClick={() => onInsertSymbol(sym)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, padding: '2px 4px', borderRadius: 4,
                    fontFamily: 'serif', color: '#374151',
                  }}
                  title={sym}
                >
                  {sym}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
