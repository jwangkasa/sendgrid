'use client';
import { Handle, Position } from '@xyflow/react';

export function UnsubscribeNode({ data: _data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const color = '#dc2626';
  return (
    <div style={{
      background: '#fff5f5',
      border: `2px solid ${selected ? color : '#fca5a5'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 180,
      boxShadow: selected ? '0 0 0 3px rgba(220,38,38,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid #b91c1c' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🚫</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.08em' }}>UNSUB CHECK</span>
      </div>
      <div style={{ fontSize: 11, color: '#991b1b' }}>Exits if unsubscribed</div>
      <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 2 }}>CAN-SPAM / GDPR compliant</div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid #b91c1c' }} />
    </div>
  );
}
