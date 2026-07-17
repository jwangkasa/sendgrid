'use client';
import { Handle, Position } from '@xyflow/react';

export function SmsNode({ data, selected }: { data: { smsBody?: string; label?: string }; selected?: boolean }) {
  const color = '#16a34a';
  const preview = data.smsBody ? data.smsBody.slice(0, 40) + (data.smsBody.length > 40 ? '…' : '') : null;
  return (
    <div style={{
      background: '#f0fdf4',
      border: `2px solid ${selected ? color : '#86efac'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 160,
      boxShadow: selected ? '0 0 0 3px rgba(22,163,74,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid #15803d' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.08em' }}>SMS</span>
      </div>
      {preview
        ? <div style={{ fontSize: 12, fontWeight: 500, color: '#166534' }}>{preview}</div>
        : <div style={{ fontSize: 11, color: '#86efac' }}>No message set</div>
      }
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid #15803d' }} />
    </div>
  );
}
