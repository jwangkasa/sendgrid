'use client';
import { Handle, Position } from '@xyflow/react';

export function ConditionNode({ data, selected }: { data: { value?: string[]; op?: string }; selected?: boolean }) {
  const label = data.value?.length ? `${data.op === 'not_in' ? 'NOT ' : ''}${data.value.join(' or ')}` : 'Set condition…';
  return (
    <div style={{
      background: '#f0fdf4',
      border: `2px solid ${selected ? '#16a34a' : '#86efac'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 180,
      boxShadow: selected ? '0 0 0 3px rgba(22,163,74,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif', position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#16a34a', border: '2px solid #15803d' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>⋔</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: '0.08em' }}>CONDITION</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Status</div>
      <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>{label}</div>
      {/* YES handle */}
      <Handle
        type="source" position={Position.Bottom} id="yes"
        style={{ left: '30%', background: '#16a34a', border: '2px solid #15803d' }}
      />
      {/* NO handle */}
      <Handle
        type="source" position={Position.Bottom} id="no"
        style={{ left: '70%', background: '#dc2626', border: '2px solid #b91c1c' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#6b7280', paddingBottom: 2 }}>
        <span style={{ paddingLeft: 4 }}>✓ YES</span>
        <span style={{ paddingRight: 4 }}>✗ NO</span>
      </div>
    </div>
  );
}
