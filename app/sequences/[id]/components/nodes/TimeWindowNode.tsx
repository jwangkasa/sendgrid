'use client';
import { Handle, Position } from '@xyflow/react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt(h: number) {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export function TimeWindowNode({ data, selected }: {
  data: { startHour?: number; endHour?: number; allowedDays?: number[]; timezone?: string };
  selected?: boolean;
}) {
  const start = data.startHour ?? 9;
  const end = data.endHour ?? 17;
  const days = data.allowedDays ?? [1, 2, 3, 4, 5];
  const tz = data.timezone ?? 'UTC';
  const dayLabel = days.length === 7 ? 'Every day'
    : days.length === 5 && days.join() === '1,2,3,4,5' ? 'Mon–Fri'
    : days.map((d) => DAY_NAMES[d]).join(', ');

  return (
    <div style={{
      background: '#ecfeff',
      border: `2px solid ${selected ? '#0891b2' : '#67e8f9'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 180,
      boxShadow: selected ? '0 0 0 3px rgba(8,145,178,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#0891b2', border: '2px solid #0e7490' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🕐</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#0891b2', letterSpacing: '0.08em' }}>TIME WINDOW</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#164e63' }}>{fmt(start)} – {fmt(end)}</div>
      <div style={{ fontSize: 10, color: '#0e7490', marginTop: 1 }}>{dayLabel} · {tz}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#0891b2', border: '2px solid #0e7490' }} />
    </div>
  );
}
