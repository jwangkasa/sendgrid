'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge, type NodeTypes, type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { StartNode } from './nodes/StartNode';
import { EmailNode } from './nodes/EmailNode';
import { WaitNode } from './nodes/WaitNode';
import { ConditionNode } from './nodes/ConditionNode';
import { GoalNode } from './nodes/GoalNode';
import { ExitNode } from './nodes/ExitNode';
import { TimeWindowNode } from './nodes/TimeWindowNode';
import { AbSplitNode } from './nodes/AbSplitNode';
import { LoopNode } from './nodes/LoopNode';
import { EndNode } from './nodes/EndNode';
import { TagNode } from './nodes/TagNode';
import { UnsubscribeNode } from './nodes/UnsubscribeNode';
import { SmsNode } from './nodes/SmsNode';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import type { SequenceNode, SequenceEdge, SequenceFlow } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  start:       StartNode as any,
  email:       EmailNode as any,
  wait:        WaitNode as any,
  condition:   ConditionNode as any,
  goal:        GoalNode as any,
  exit:        ExitNode as any,
  timeWindow:  TimeWindowNode as any,
  abSplit:     AbSplitNode as any,
  loop:        LoopNode as any,
  end:         EndNode as any,
  tag:         TagNode as any,
  unsubscribe: UnsubscribeNode as any,
  sms:         SmsNode as any,
};

interface Props {
  initialFlow: SequenceFlow;
  idToken: string | null;
  onChange: (flow: SequenceFlow) => void;
}

export function FlowCanvas({ initialFlow, idToken, onChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    initialFlow.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialFlow.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: e.label,
      style: e.label === 'no' ? { stroke: '#dc2626' } : e.label === 'yes' ? { stroke: '#16a34a' } : undefined,
    })),
  );
  const [selectedNode, setSelectedNode] = useState<SequenceNode | null>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const emitChange = useCallback((ns: Node[], es: Edge[]) => {
    onChange({
      nodes: ns.map((n) => ({ id: n.id, type: n.type as SequenceNode['type'], position: n.position, data: n.data as SequenceNode['data'] })),
      edges: es.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, label: e.label as string | undefined })),
    });
  }, [onChange]);

  const onConnect = useCallback((connection: Connection) => {
    const label = connection.sourceHandle === 'yes' ? 'yes' : connection.sourceHandle === 'no' ? 'no' : undefined;
    setEdges((eds) => {
      const newEdges = addEdge({
        ...connection,
        id: uuidv4(),
        label,
        style: label === 'no' ? { stroke: '#dc2626' } : label === 'yes' ? { stroke: '#16a34a' } : undefined,
      }, eds);
      emitChange(nodes, newEdges);
      return newEdges;
    });
  }, [setEdges, emitChange, nodes]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type || !rfInstance.current) return;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = rfInstance.current.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const id = `n-${uuidv4().slice(0, 8)}`;
    const newNode: Node = { id, type, position, data: { label: type.charAt(0).toUpperCase() + type.slice(1) } };
    setNodes((nds) => {
      const next = [...nds, newNode];
      emitChange(next, edges);
      return next;
    });
  }, [setNodes, emitChange, edges]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode({ id: node.id, type: node.type as SequenceNode['type'], position: node.position, data: node.data as SequenceNode['data'] });
  }, []);

  const handleUpdateNodeData = useCallback((id: string, patch: Partial<SequenceNode['data']>) => {
    setNodes((nds) => {
      const next = nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n);
      emitChange(next, edges);
      return next;
    });
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev);
  }, [setNodes, emitChange, edges]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => {
      const next = nds.filter((n) => n.id !== id);
      setEdges((eds) => {
        const nextEdges = eds.filter((e) => e.source !== id && e.target !== id);
        emitChange(next, nextEdges);
        return nextEdges;
      });
      return next;
    });
    setSelectedNode(null);
  }, [setNodes, setEdges, emitChange]);

  const handleSwapBranches = useCallback((id: string) => {
    setEdges((eds) => {
      const next = eds.map((e) => {
        if (e.source !== id) return e;
        const newLabel = e.label === 'yes' ? 'no' : e.label === 'no' ? 'yes' : e.label;
        return {
          ...e,
          label: newLabel,
          style: newLabel === 'no' ? { stroke: '#dc2626' } : newLabel === 'yes' ? { stroke: '#16a34a' } : e.style,
        };
      });
      emitChange(nodes, next);
      return next;
    });
  }, [setEdges, emitChange, nodes]);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <NodePalette />
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            // emit on position changes
            setNodes((nds) => { emitChange(nds, edges); return nds; });
          }}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          onInit={(inst) => { rfInstance.current = inst; }}
          fitView
          deleteKeyCode={null}
        >
          <Background gap={20} color="#e2e8f0" />
          <Controls />
          <MiniMap nodeColor={(n) => {
            const m: Record<string, string> = {
              start: '#0f52ba', email: '#6366f1', wait: '#d97706', condition: '#16a34a',
              goal: '#e11d48', exit: '#64748b', timeWindow: '#0891b2', abSplit: '#7c3aed', loop: '#ea580c',
              end: '#475569', tag: '#0d9488', unsubscribe: '#dc2626', sms: '#16a34a',
            };
            return m[n.type ?? ''] ?? '#94a3b8';
          }} />
        </ReactFlow>

        {/* Empty state hint */}
        {nodes.length <= 1 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', textAlign: 'center', color: '#94a3b8', fontFamily: 'Inter,Arial,sans-serif' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⋔</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Drag nodes from the left panel</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Connect them to build your email sequence</div>
          </div>
        )}
      </div>

      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          idToken={idToken}
          onUpdate={handleUpdateNodeData}
          onDelete={handleDeleteNode}
          onClose={() => setSelectedNode(null)}
          onSwapBranches={handleSwapBranches}
        />
      )}
    </div>
  );
}
