'use client';
import { Handle, Position } from '@xyflow/react';

export function StartNode({ data, selected }: { data: { label?: string; batchId?: string }; selected?: boolean }) {
  return (
    <div style={{
      background: selected ? '#0f52ba' : '#1a6fd4',
      border: `2px solid ${selected ? '#0a3d8a' : '#0f52ba'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 160,
      boxShadow: selected ? '0 0 0 3px rgba(15,82,186,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
      color: '#fff', fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.8, marginBottom: 2 }}>START</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{data.label ?? 'Campaign Start'}</div>
      {data.batchId && <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>Batch: {data.batchId.slice(0, 12)}…</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: '#fff', border: '2px solid #0f52ba' }} />
    </div>
  );
}
