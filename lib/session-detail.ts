// ─── Session Detail Parser ───────────────────────────────────────────
// Parses a single Claude Code JSONL session file into a workflow DAG
// and chat log for visualization (inspired by CommuGraph).

import fs from 'fs'

// ─── Types ───────────────────────────────────────────────────────────

export type WorkflowNodeType =
  | 'user_input'
  | 'thinking'
  | 'text_response'
  | 'tool_call'
  | 'tool_result'
  | 'system'

export interface WorkflowNode {
  id: string
  stepIndex: number
  timestamp: string
  nodeType: WorkflowNodeType
  label: string
  content: string
  contentPreview: string
  toolName?: string
  toolInput?: string
  parentId: string | null
  durationMs?: number
  isError?: boolean
  isSidechain?: boolean
  agentId?: string
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  durationMs?: number
}

export interface ChatMessage {
  id: string
  stepIndex: number
  timestamp: string
  role: 'user' | 'assistant' | 'system' | 'tool_result'
  content: string
  toolName?: string
  isThinking?: boolean
  isSidechain?: boolean
  agentId?: string
  images?: number
}

export interface SessionDetail {
  sessionId: string
  workflowNodes: WorkflowNode[]
  workflowEdges: WorkflowEdge[]
  chatLog: ChatMessage[]
  stats: {
    totalMessages: number
    userTurns: number
    assistantTurns: number
    toolCalls: number
    successCount: number
    failureCount: number
    duration: string
    tokens: number
  }
}

// ─── Parser ──────────────────────────────────────────────────────────

interface RawEntry {
  uuid?: string
  parentUuid?: string
  type?: string
  timestamp?: string
  isSidechain?: boolean
  message?: {
    role?: string
    content?: unknown[]
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
    }
  }
}

export function parseSessionDetail(filePath: string, sessionId: string): SessionDetail {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')

  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  const chatLog: ChatMessage[] = []

  let stepIndex = 0
  let lastNodeId: string | null = null
  let totalTokens = 0
  let toolCallCount = 0
  let successCount = 0
  let failureCount = 0
  let userTurns = 0
  let assistantTurns = 0
  let firstTimestamp = ''
  let lastTimestamp = ''

  for (const line of lines) {
    if (!line.trim()) continue
    let entry: RawEntry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }

    const ts = entry.timestamp || ''
    if (ts && !firstTimestamp) firstTimestamp = ts
    if (ts) lastTimestamp = ts

    const uuid = entry.uuid || `step-${stepIndex}`
    const parentUuid = entry.parentUuid || null
    const isSidechain = entry.isSidechain || false

    if (entry.type === 'user') {
      stepIndex++
      userTurns++

      // Extract user text
      let text = ''
      let imageCount = 0
      const msg = entry.message
      if (msg?.content && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (typeof block === 'object' && block !== null) {
            const b = block as Record<string, unknown>
            if (b.type === 'text') text += (b.text as string) || ''
            else if (b.type === 'tool_result') {
              const resultContent = b.content
              if (typeof resultContent === 'string') text += resultContent
              else if (Array.isArray(resultContent)) {
                for (const rc of resultContent) {
                  if (typeof rc === 'object' && rc !== null) {
                    const r = rc as Record<string, unknown>
                    if (r.type === 'text') text += (r.text as string) || ''
                  }
                }
              }
              // This is actually a tool result
              const isError = b.is_error === true
              const toolUseId = b.tool_use_id as string | undefined

              if (isError) failureCount++
              else successCount++

              const resultNode: WorkflowNode = {
                id: `${uuid}-result`,
                stepIndex,
                timestamp: ts,
                nodeType: 'tool_result',
                label: isError ? 'Error' : 'Result',
                content: text.slice(0, 500),
                contentPreview: text.slice(0, 100),
                parentId: toolUseId ? `tool-${toolUseId}` : lastNodeId,
                isError,
                isSidechain,
              }
              nodes.push(resultNode)

              if (resultNode.parentId) {
                edges.push({
                  id: `e-${resultNode.parentId}-${resultNode.id}`,
                  source: resultNode.parentId,
                  target: resultNode.id,
                })
              }

              chatLog.push({
                id: `${uuid}-result`,
                stepIndex,
                timestamp: ts,
                role: 'tool_result',
                content: text.slice(0, 300),
                isSidechain,
              })

              lastNodeId = resultNode.id
              text = ''
              continue
            } else if (b.type === 'image') {
              imageCount++
            }
          } else if (typeof block === 'string') {
            text += block
          }
        }
      } else if (typeof msg?.content === 'string') {
        text = msg.content
      }

      if (!text && imageCount === 0) continue

      const nodeId = uuid
      const node: WorkflowNode = {
        id: nodeId,
        stepIndex,
        timestamp: ts,
        nodeType: 'user_input',
        label: 'User Input',
        content: text,
        contentPreview: text.slice(0, 100) || `[${imageCount} image(s)]`,
        parentId: lastNodeId,
        isSidechain,
      }
      nodes.push(node)

      if (lastNodeId) {
        edges.push({ id: `e-${lastNodeId}-${nodeId}`, source: lastNodeId, target: nodeId })
      }

      chatLog.push({
        id: nodeId,
        stepIndex,
        timestamp: ts,
        role: 'user',
        content: text || `[${imageCount} image(s)]`,
        isSidechain,
        images: imageCount,
      })

      lastNodeId = nodeId

    } else if (entry.type === 'assistant' && entry.message) {
      const msg = entry.message
      assistantTurns++

      if (msg.usage) {
        totalTokens += (msg.usage.input_tokens || 0) + (msg.usage.output_tokens || 0)
      }

      if (!Array.isArray(msg.content)) continue

      for (const block of msg.content) {
        if (typeof block !== 'object' || block === null) continue
        const b = block as Record<string, unknown>

        if (b.type === 'thinking') {
          stepIndex++
          const text = (b.thinking as string) || ''
          const nodeId = `${uuid}-thinking-${stepIndex}`

          nodes.push({
            id: nodeId,
            stepIndex,
            timestamp: ts,
            nodeType: 'thinking',
            label: 'Thinking',
            content: text,
            contentPreview: text.slice(0, 100),
            parentId: lastNodeId,
            isSidechain,
          })

          if (lastNodeId) {
            edges.push({ id: `e-${lastNodeId}-${nodeId}`, source: lastNodeId, target: nodeId })
          }

          chatLog.push({
            id: nodeId,
            stepIndex,
            timestamp: ts,
            role: 'assistant',
            content: text.slice(0, 300),
            isThinking: true,
            isSidechain,
          })

          lastNodeId = nodeId

        } else if (b.type === 'text') {
          stepIndex++
          const text = (b.text as string) || ''
          if (!text.trim()) continue
          const nodeId = `${uuid}-text-${stepIndex}`

          nodes.push({
            id: nodeId,
            stepIndex,
            timestamp: ts,
            nodeType: 'text_response',
            label: 'Response',
            content: text,
            contentPreview: text.slice(0, 100),
            parentId: lastNodeId,
            isSidechain,
          })

          if (lastNodeId) {
            edges.push({ id: `e-${lastNodeId}-${nodeId}`, source: lastNodeId, target: nodeId })
          }

          chatLog.push({
            id: nodeId,
            stepIndex,
            timestamp: ts,
            role: 'assistant',
            content: text.slice(0, 500),
            isSidechain,
          })

          lastNodeId = nodeId

        } else if (b.type === 'tool_use') {
          stepIndex++
          toolCallCount++
          const toolName = (b.name as string) || 'unknown'
          const toolInput = b.input ? JSON.stringify(b.input).slice(0, 200) : ''
          const toolUseId = (b.id as string) || `tool-${stepIndex}`
          const nodeId = `tool-${toolUseId}`

          nodes.push({
            id: nodeId,
            stepIndex,
            timestamp: ts,
            nodeType: 'tool_call',
            label: toolName,
            content: toolInput,
            contentPreview: toolInput.slice(0, 80),
            toolName,
            toolInput,
            parentId: lastNodeId,
            isSidechain,
          })

          if (lastNodeId) {
            edges.push({ id: `e-${lastNodeId}-${nodeId}`, source: lastNodeId, target: nodeId })
          }

          chatLog.push({
            id: nodeId,
            stepIndex,
            timestamp: ts,
            role: 'assistant',
            content: `${toolName}: ${toolInput.slice(0, 200)}`,
            toolName,
            isSidechain,
          })

          lastNodeId = nodeId
        }
      }
    }
  }

  // Compute duration
  let durationStr = '0s'
  if (firstTimestamp && lastTimestamp) {
    const ms = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime()
    const mins = ms / 60000
    if (mins < 1) durationStr = `${Math.round(ms / 1000)}s`
    else if (mins < 60) durationStr = `${Math.round(mins)}m`
    else durationStr = `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
  }

  return {
    sessionId,
    workflowNodes: nodes,
    workflowEdges: edges,
    chatLog,
    stats: {
      totalMessages: userTurns + assistantTurns,
      userTurns,
      assistantTurns,
      toolCalls: toolCallCount,
      successCount,
      failureCount,
      duration: durationStr,
      tokens: totalTokens,
    },
  }
}
