'use client';

const NODE_TYPES = [
  { type: 'email',     label: 'Email',     icon: '✉', color: '#6366f1', desc: 'Send an email' },
  { type: 'wait',      label: 'Wait',      icon: '⏱', color: '#d97706', desc: 'Delay before next step' },
  { type: 'condition', label: 'Condition', icon: '⋔', color: '#16a34a', desc: 'Branch on engagement' },
];

export function NodePalette() {
  function onDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div style={{ width: 160, background: '#fff', borderRight: '1px solid #e2e8f0', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'Inter,Arial,sans-serif' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', marginBottom: 4 }}>DRAG TO ADD</div>
      {NODE_TYPES.map(({ type, label, icon, color, desc }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          style={{
            padding: '8px 10px', borderRadius: 8, border: `1px solid ${color}30`,
            background: `${color}08`, cursor: 'grab', userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}
