'use client';
import { Handle, Position } from '@xyflow/react';

export function AbSplitNode({ data, selected }: { data: { splitPercent?: number }; selected?: boolean }) {
  const pctA = data.splitPercent ?? 50;
  const pctB = 100 - pctA;
  const color = '#7c3aed';
  return (
    <div style={{
      background: '#faf5ff',
      border: `2px solid ${selected ? color : '#c4b5fd'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 180,
      boxShadow: selected ? `0 0 0 3px rgba(124,58,237,0.2)` : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif', position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid #6d28d9' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.08em' }}>A/B SPLIT</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4c1d95' }}>A {pctA}% · B {pctB}%</div>
      {/* A handle */}
      <Handle type="source" position={Position.Bottom} id="a"
        style={{ left: '30%', background: color, border: '2px solid #6d28d9' }} />
      {/* B handle */}
      <Handle type="source" position={Position.Bottom} id="b"
        style={{ left: '70%', background: '#a78bfa', border: '2px solid #7c3aed' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#7c3aed', paddingBottom: 2 }}>
        <span style={{ paddingLeft: 4 }}>A</span>
        <span style={{ paddingRight: 4 }}>B</span>
      </div>
    </div>
  );
}
