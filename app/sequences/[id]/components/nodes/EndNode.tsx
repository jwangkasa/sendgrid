'use client';
import { Handle, Position } from '@xyflow/react';

export function EndNode({ data, selected }: { data: { label?: string }; selected?: boolean }) {
  return (
    <div style={{
      background: '#f1f5f9',
      border: `2px solid ${selected ? '#475569' : '#94a3b8'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 140,
      boxShadow: selected ? '0 0 0 3px rgba(71,85,105,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#475569', border: '2px solid #334155' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🏁</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>END</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{data.label || 'Sequence complete'}</div>
    </div>
  );
}
