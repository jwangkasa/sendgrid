'use client';
import { Handle, Position } from '@xyflow/react';

export function TagNode({ data, selected }: { data: { tagName?: string }; selected?: boolean }) {
  const color = '#0d9488';
  return (
    <div style={{
      background: '#f0fdfa',
      border: `2px solid ${selected ? color : '#5eead4'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 160,
      boxShadow: selected ? '0 0 0 3px rgba(13,148,136,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid #0f766e' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🏷</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.08em' }}>TAG</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#134e4a' }}>
        {data.tagName ? `"${data.tagName}"` : 'Set tag name…'}
      </div>
      <div style={{ fontSize: 10, color: '#0f766e', marginTop: 2 }}>Applies label to recipient</div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid #0f766e' }} />
    </div>
  );
}
