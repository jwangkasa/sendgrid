'use client';
import { Handle, Position } from '@xyflow/react';

export function GoalNode({ data, selected }: { data: { goalName?: string }; selected?: boolean }) {
  return (
    <div style={{
      background: '#fff1f2',
      border: `2px solid ${selected ? '#e11d48' : '#fda4af'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 160,
      boxShadow: selected ? '0 0 0 3px rgba(225,29,72,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#e11d48', border: '2px solid #be123c' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#e11d48', letterSpacing: '0.08em' }}>GOAL</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#9f1239' }}>{data.goalName || 'Set goal name…'}</div>
      <div style={{ fontSize: 10, color: '#fb7185', marginTop: 2 }}>Marks recipient as converted</div>
    </div>
  );
}
