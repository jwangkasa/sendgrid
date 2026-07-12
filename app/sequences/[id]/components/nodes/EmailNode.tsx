'use client';
import { Handle, Position } from '@xyflow/react';

export function EmailNode({ data, selected }: { data: { label?: string; template?: { subject?: string } }; selected?: boolean }) {
  return (
    <div style={{
      background: '#fff',
      border: `2px solid ${selected ? '#6366f1' : '#e2e8f0'}`,
      borderRadius: 8, padding: '7px 12px', minWidth: 140,
      boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.2)' : '0 1px 4px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#6366f1', border: '2px solid #4f46e5' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>✉</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em' }}>EMAIL</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{data.label ?? 'Email'}</div>
      {data.template?.subject && (
        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
          {data.template.subject}
        </div>
      )}
      {!data.template?.subject && (
        <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 1 }}>⚠ No template set</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1', border: '2px solid #4f46e5' }} />
    </div>
  );
}
