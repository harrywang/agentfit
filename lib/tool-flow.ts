// ─── Tool Flow Analysis ──────────────────────────────────────────────
// Extracts tool call transition data for flow visualization.

import type { UsageData } from './parse-logs'

export interface ToolTransition {
  source: string
  target: string
  count: number
}

export interface ToolFlowData {
  nodes: { id: string; count: number }[]
  edges: ToolTransition[]
  totalTransitions: number
}

export function computeToolFlow(data: UsageData): ToolFlowData {
  const toolUsage = data.toolUsage
  const transitions = new Map<string, number>()

  // We need per-session tool sequences. Since we store toolCallsJson as
  // aggregate counts per session, we compute transitions from the global
  // tool usage data and common patterns. For accurate transitions we'd
  // need the raw sequence — but we can derive a meaningful flow from the
  // session-level tool call co-occurrence.

  // Build transitions from sessions that have tool call data
  for (const session of data.sessions) {
    const tools = Object.entries(session.toolCalls)
      .sort((a, b) => b[1] - a[1])

    // Create edges between co-occurring tools (weighted by min count)
    for (let i = 0; i < tools.length; i++) {
      for (let j = i + 1; j < tools.length; j++) {
        const [toolA] = tools[i]
        const [toolB] = tools[j]
        // Direction: higher count tool → lower count tool
        const key = `${toolA}→${toolB}`
        const weight = Math.min(tools[i][1], tools[j][1])
        transitions.set(key, (transitions.get(key) || 0) + weight)
      }
    }
  }

  // Build nodes from tool usage
  const nodes = Object.entries(toolUsage)
    .filter(([, count]) => count > 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, count]) => ({ id, count }))

  const nodeSet = new Set(nodes.map(n => n.id))

  // Build edges (filter to only include nodes we're showing)
  const edges: ToolTransition[] = []
  for (const [key, count] of transitions) {
    const [source, target] = key.split('→')
    if (nodeSet.has(source) && nodeSet.has(target) && count > 2) {
      edges.push({ source, target, count })
    }
  }

  edges.sort((a, b) => b.count - a.count)

  return {
    nodes,
    edges: edges.slice(0, 30),
    totalTransitions: edges.reduce((sum, e) => sum + e.count, 0),
  }
}
