'use client';
import { Handle, Position } from '@xyflow/react';

const DEFAULT_EXIT_ON = ['Bounced', 'Dropped'];

export function ExitNode({ data, selected }: { data: { exitOn?: string[] }; selected?: boolean }) {
  const statuses = data.exitOn?.length ? data.exitOn : DEFAULT_EXIT_ON;
  return (
    <div style={{
      background: '#f8fafc',
      border: `2px solid ${selected ? '#64748b' : '#cbd5e1'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 160,
      boxShadow: selected ? '0 0 0 3px rgba(100,116,139,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#64748b', border: '2px solid #475569' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🚪</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>EXIT CHECK</span>
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Exit if: {statuses.join(', ')}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#64748b', border: '2px solid #475569' }} />
    </div>
  );
}
