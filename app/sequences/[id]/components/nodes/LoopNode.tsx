'use client';
import { Handle, Position } from '@xyflow/react';

export function LoopNode({ data, selected }: {
  data: { maxIterations?: number; loopCondition?: string[] };
  selected?: boolean;
}) {
  const max = data.maxIterations ?? 3;
  const cond = data.loopCondition?.length ? data.loopCondition.join(' or ') : null;
  const color = '#ea580c';
  return (
    <div style={{
      background: '#fff7ed',
      border: `2px solid ${selected ? color : '#fdba74'}`,
      borderRadius: 10, padding: '10px 18px', minWidth: 180,
      boxShadow: selected ? '0 0 0 3px rgba(234,88,12,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter,Arial,sans-serif', position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid #c2410c' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>↩</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.08em' }}>LOOP</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#7c2d12' }}>Up to {max}×</div>
      {cond && <div style={{ fontSize: 10, color: '#c2410c', marginTop: 1 }}>Exit if: {cond}</div>}
      {/* loop back handle */}
      <Handle type="source" position={Position.Bottom} id="loop"
        style={{ left: '30%', background: color, border: '2px solid #c2410c' }} />
      {/* continue handle */}
      <Handle type="source" position={Position.Bottom} id="exit"
        style={{ left: '70%', background: '#94a3b8', border: '2px solid #64748b' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#9ca3af', paddingBottom: 2 }}>
        <span style={{ paddingLeft: 4, color }}>↩ Loop</span>
        <span style={{ paddingRight: 4 }}>→ Continue</span>
      </div>
    </div>
  );
}
