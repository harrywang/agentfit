'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { UsageData } from '@/lib/parse-logs'
import { computeToolFlow } from '@/lib/tool-flow'
import { formatNumber } from '@/lib/format'

const TOOL_COLORS: Record<string, string> = {
  Read: '#6b9bd2',
  Edit: '#7bc8a4',
  Write: '#7bc8a4',
  Bash: '#d4a574',
  Grep: '#6b9bd2',
  Glob: '#6b9bd2',
  Agent: '#b8a9d4',
  Skill: '#b8a9d4',
  WebSearch: '#d4a5a5',
  WebFetch: '#d4a5a5',
}

function getToolColor(tool: string): string {
  return TOOL_COLORS[tool] || '#94a3b8'
}

export function ToolFlowGraph({ data }: { data: UsageData }) {
  const flow = useMemo(() => computeToolFlow(data), [data])

  const { nodes, edges } = useMemo(() => {
    if (flow.nodes.length === 0) return { nodes: [], edges: [] }

    const maxCount = Math.max(...flow.nodes.map(n => n.count))
    const centerX = 400
    const centerY = 300
    const radius = 220

    const rfNodes: Node[] = flow.nodes.map((n, i) => {
      const angle = (i / flow.nodes.length) * 2 * Math.PI - Math.PI / 2
      const size = 40 + (n.count / maxCount) * 60

      return {
        id: n.id,
        position: {
          x: centerX + radius * Math.cos(angle) - size / 2,
          y: centerY + radius * Math.sin(angle) - size / 2,
        },
        data: {
          label: (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-semibold">{n.id}</span>
              <span className="text-[10px] text-muted-foreground">{formatNumber(n.count)}</span>
            </div>
          ),
        },
        style: {
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: getToolColor(n.id),
          border: '2px solid rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: 11,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      }
    })

    const maxEdgeCount = Math.max(...flow.edges.map(e => e.count), 1)

    const rfEdges: Edge[] = flow.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      animated: e.count > maxEdgeCount * 0.5,
      style: {
        strokeWidth: 1 + (e.count / maxEdgeCount) * 4,
        opacity: 0.3 + (e.count / maxEdgeCount) * 0.5,
        stroke: getToolColor(e.source),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
      },
      label: e.count > maxEdgeCount * 0.2 ? String(e.count) : undefined,
      labelStyle: { fontSize: 10, fill: '#94a3b8' },
    }))

    return { nodes: rfNodes, edges: rfEdges }
  }, [flow])

  if (flow.nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tool Flow</CardTitle>
          <CardDescription>Not enough tool data for visualization</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Flow Graph</CardTitle>
        <CardDescription>
          How tools connect — node size = usage frequency, edge thickness = co-occurrence strength.
          Top {flow.nodes.length} tools with {flow.edges.length} connections.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: 600 }} className="rounded-lg border bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable
            nodesConnectable={false}
            minZoom={0.3}
            maxZoom={2}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  )
}
