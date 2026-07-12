'use client';
import { Handle, Position } from '@xyflow/react';

export function EmailNode({ data, selected }: { data: { label?: string; template?: { subject?: string } }; selected?: boolean }) {
  return (
    <div style={{
      background: '#fff',
      border: `2px solid ${selected ? '#6366f1' : '#e2e8f0'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 180,
      boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#6366f1', border: '2px solid #4f46e5' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>✉</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em' }}>EMAIL</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{data.label ?? 'Email'}</div>
      {data.template?.subject && (
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
          {data.template.subject}
        </div>
      )}
      {!data.template?.subject && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>⚠ No template set</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1', border: '2px solid #4f46e5' }} />
    </div>
  );
}
