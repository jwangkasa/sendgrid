'use client';
import { Handle, Position } from '@xyflow/react';

export function WaitNode({ data, selected }: { data: { amount?: number; unit?: string; days?: number; date?: string | null }; selected?: boolean }) {
  let label: string;
  if (data.date) {
    label = `Until ${data.date}`;
  } else if (data.amount !== undefined) {
    const amt = data.amount;
    const unit = data.unit ?? 'days';
    const singular = unit.replace(/s$/, '');
    label = `Wait ${amt} ${amt === 1 ? singular : unit}`;
  } else {
    // legacy days field
    const d = data.days ?? 1;
    label = `Wait ${d} day${d !== 1 ? 's' : ''}`;
  }
  return (
    <div style={{
      background: '#fffbeb',
      border: `2px solid ${selected ? '#f59e0b' : '#fcd34d'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 160,
      boxShadow: selected ? '0 0 0 3px rgba(245,158,11,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b', border: '2px solid #d97706' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>⏱</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', letterSpacing: '0.08em' }}>WAIT</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>{label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#f59e0b', border: '2px solid #d97706' }} />
    </div>
  );
}
