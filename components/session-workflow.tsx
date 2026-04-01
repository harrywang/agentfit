'use client'

import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import type { WorkflowNode, WorkflowEdge } from '@/lib/session-detail'

// ─── Node Colors ─────────────────────────────────────────────────────

const NODE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  user_input:    { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  thinking:      { bg: '#faf5ff', border: '#8b5cf6', text: '#6d28d9' },
  text_response: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  tool_call:     { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
  tool_result:   { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  system:        { bg: '#f8fafc', border: '#94a3b8', text: '#475569' },
}

const ERROR_STYLE = { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' }

// ─── Dagre Layout ────────────────────────────────────────────────────

function layoutNodes(
  wfNodes: WorkflowNode[],
  wfEdges: WorkflowEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 50, nodesep: 40, marginx: 20, marginy: 20 })

  const limitedNodes = wfNodes.slice(0, 200)
  const nodeIds = new Set(limitedNodes.map(n => n.id))
  const nodeWidth = 260

  for (const node of limitedNodes) {
    g.setNode(node.id, { width: nodeWidth, height: 80 })
  }

  for (const edge of wfEdges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const nodes: Node[] = limitedNodes.map(node => {
    const pos = g.node(node.id)
    const style = node.isError ? ERROR_STYLE : (NODE_STYLES[node.nodeType] || NODE_STYLES.system)

    return {
      id: node.id,
      position: { x: (pos?.x || 0) - nodeWidth / 2, y: (pos?.y || 0) - 40 },
      width: nodeWidth,
      height: 80,
      measured: { width: nodeWidth, height: 80 },
      data: {
        color: style.border,
        label: (
          <div className="text-left px-2 py-1 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: style.border }}
              />
              <span className="text-[11px] font-semibold truncate" style={{ color: style.text }}>
                {node.label}
              </span>
              {node.toolName && (
                <span className="text-[10px] text-muted-foreground">
                  #{node.stepIndex}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {node.contentPreview || '...'}
            </div>
          </div>
        ),
      },
      style: {
        width: nodeWidth,
        minHeight: 60,
        backgroundColor: style.bg,
        border: `1.5px solid ${style.border}`,
        borderRadius: 8,
        fontSize: 11,
        padding: 0,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }
  })

  const edges: Edge[] = wfEdges
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: '#94a3b8' },
    }))

  return { nodes, edges }
}

// ─── Inner component (needs ReactFlowProvider) ──────────────────────

function WorkflowInner({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const { fitView } = useReactFlow()

  // On initial render, zoom to the first 5 nodes
  const onInit = useCallback(() => {
    const firstNodeIds = nodes.slice(0, 5).map(n => n.id)
    setTimeout(() => {
      fitView({ nodes: firstNodeIds.map(id => ({ id })), padding: 0.3, duration: 300 })
    }, 100)
  }, [nodes, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onInit={onInit}
      nodesDraggable
      nodesConnectable={false}
      minZoom={0.05}
      maxZoom={2}
      defaultEdgeOptions={{ animated: false }}
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(node) => (node.data as Record<string, string>)?.color || '#94a3b8'}
        nodeStrokeWidth={0}
        maskColor="rgba(0,0,0,0.08)"
        style={{ width: 200, height: 160 }}
        pannable
        zoomable
      />
    </ReactFlow>
  )
}

// ─── Exported Component ──────────────────────────────────────────────

export function SessionWorkflow({
  nodes: wfNodes,
  edges: wfEdges,
}: {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}) {
  const { nodes, edges } = useMemo(
    () => layoutNodes(wfNodes, wfEdges),
    [wfNodes, wfEdges]
  )

  if (nodes.length === 0) {
    return <div className="text-muted-foreground text-sm p-4">No workflow data</div>
  }

  return (
    <div style={{ height: 700 }} className="w-full rounded-lg border bg-background">
      <ReactFlowProvider>
        <WorkflowInner nodes={nodes} edges={edges} />
      </ReactFlowProvider>
    </div>
  )
}
