import fs from 'fs'
import type { ChatMessage, SessionDetail, WorkflowEdge, WorkflowNode } from '@/lib/session-detail'

interface CodexEntry {
  timestamp?: string
  type?: string
  payload?: Record<string, unknown>
}

export function parseCodexSessionDetail(filePath: string, sessionId: string): SessionDetail {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')

  const workflowNodes: WorkflowNode[] = []
  const workflowEdges: WorkflowEdge[] = []
  const chatLog: ChatMessage[] = []

  let stepIndex = 0
  let lastNodeId: string | null = null
  let userTurns = 0
  let assistantTurns = 0
  let toolCalls = 0
  let successCount = 0
  let failureCount = 0
  let totalTokens = 0
  let firstTimestamp = ''
  let lastTimestamp = ''

  const toolNameByCallId = new Map<string, string>()

  for (const line of lines) {
    if (!line.trim()) continue

    let entry: CodexEntry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }

    const ts = entry.timestamp || ''
    if (ts && !firstTimestamp) firstTimestamp = ts
    if (ts) lastTimestamp = ts

    if (entry.type === 'event_msg') {
      const payload = entry.payload || {}
      if (payload.type === 'token_count') {
        const info = payload.info as Record<string, unknown> | undefined
        const totalUsage = info?.total_token_usage as Record<string, unknown> | undefined
        const tokens = Number(totalUsage?.total_tokens || 0)
        if (Number.isFinite(tokens)) totalTokens = Math.max(totalTokens, tokens)
      }
      continue
    }

    if (entry.type !== 'response_item') continue

    const payload = entry.payload || {}
    const itemType = (payload.type as string) || ''
    const role = (payload.role as string) || ''

    if (itemType === 'message' && role === 'user') {
      const text = extractContentText(payload.content)
      if (!text) continue

      stepIndex++
      userTurns++
      const nodeId = `u-${stepIndex}`
      pushNode(
        workflowNodes,
        workflowEdges,
        {
          id: nodeId,
          stepIndex,
          timestamp: ts,
          nodeType: 'user_input',
          label: 'User Input',
          content: text,
          contentPreview: preview(text),
          parentId: lastNodeId,
        },
        lastNodeId
      )
      lastNodeId = nodeId

      chatLog.push({
        id: nodeId,
        stepIndex,
        timestamp: ts,
        role: 'user',
        content: text,
      })
      continue
    }

    if (itemType === 'message' && role === 'assistant') {
      const text = extractContentText(payload.content)
      if (!text) continue

      stepIndex++
      assistantTurns++
      const nodeId = `a-${stepIndex}`
      pushNode(
        workflowNodes,
        workflowEdges,
        {
          id: nodeId,
          stepIndex,
          timestamp: ts,
          nodeType: 'text_response',
          label: 'Assistant',
          content: text,
          contentPreview: preview(text),
          parentId: lastNodeId,
        },
        lastNodeId
      )
      lastNodeId = nodeId

      chatLog.push({
        id: nodeId,
        stepIndex,
        timestamp: ts,
        role: 'assistant',
        content: text,
      })
      continue
    }

    if (itemType === 'reasoning') {
      const text = extractReasoningText(payload)
      if (!text) continue

      stepIndex++
      const nodeId = `r-${stepIndex}`
      pushNode(
        workflowNodes,
        workflowEdges,
        {
          id: nodeId,
          stepIndex,
          timestamp: ts,
          nodeType: 'thinking',
          label: 'Thinking',
          content: text,
          contentPreview: preview(text),
          parentId: lastNodeId,
        },
        lastNodeId
      )
      lastNodeId = nodeId

      chatLog.push({
        id: nodeId,
        stepIndex,
        timestamp: ts,
        role: 'assistant',
        content: text,
        isThinking: true,
      })
      continue
    }

    if (itemType === 'function_call') {
      const toolName = (payload.name as string) || 'unknown'
      const callId = (payload.call_id as string) || ''
      if (callId) toolNameByCallId.set(callId, toolName)

      const toolInput = normalizeText(payload.arguments)
      toolCalls++
      stepIndex++

      const nodeId = `tool-${stepIndex}`
      pushNode(
        workflowNodes,
        workflowEdges,
        {
          id: nodeId,
          stepIndex,
          timestamp: ts,
          nodeType: 'tool_call',
          label: toolName,
          content: toolInput,
          contentPreview: preview(toolInput),
          toolName,
          toolInput,
          parentId: lastNodeId,
        },
        lastNodeId
      )
      lastNodeId = nodeId

      chatLog.push({
        id: nodeId,
        stepIndex,
        timestamp: ts,
        role: 'assistant',
        content: `${toolName}: ${preview(toolInput, 500)}`,
        toolName,
      })
      continue
    }

    if (itemType === 'web_search_call') {
      const action = payload.action as Record<string, unknown> | undefined
      const query = typeof action?.query === 'string' ? action.query : normalizeText(action)
      toolCalls++
      stepIndex++

      const nodeId = `tool-web-${stepIndex}`
      pushNode(
        workflowNodes,
        workflowEdges,
        {
          id: nodeId,
          stepIndex,
          timestamp: ts,
          nodeType: 'tool_call',
          label: 'web.search',
          content: query,
          contentPreview: preview(query),
          toolName: 'web.search',
          toolInput: query,
          parentId: lastNodeId,
        },
        lastNodeId
      )
      lastNodeId = nodeId

      chatLog.push({
        id: nodeId,
        stepIndex,
        timestamp: ts,
        role: 'assistant',
        content: `web.search: ${preview(query, 500)}`,
        toolName: 'web.search',
      })
      continue
    }

    if (itemType === 'function_call_output') {
      const callId = (payload.call_id as string) || ''
      const toolName = toolNameByCallId.get(callId)
      const output = normalizeText(payload.output)
      const isError = hasToolError(output)
      if (isError) failureCount++
      else successCount++

      stepIndex++
      const nodeId = `result-${stepIndex}`
      pushNode(
        workflowNodes,
        workflowEdges,
        {
          id: nodeId,
          stepIndex,
          timestamp: ts,
          nodeType: 'tool_result',
          label: toolName ? `${toolName} Result` : 'Tool Result',
          content: output,
          contentPreview: preview(output),
          toolName,
          parentId: lastNodeId,
          isError,
        },
        lastNodeId
      )
      lastNodeId = nodeId

      chatLog.push({
        id: nodeId,
        stepIndex,
        timestamp: ts,
        role: 'tool_result',
        content: output,
        toolName,
      })
    }
  }

  const duration = formatDuration(firstTimestamp, lastTimestamp)

  return {
    sessionId,
    workflowNodes,
    workflowEdges,
    chatLog,
    stats: {
      totalMessages: userTurns + assistantTurns,
      userTurns,
      assistantTurns,
      toolCalls,
      successCount,
      failureCount,
      duration,
      tokens: totalTokens,
    },
  }
}

function pushNode(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  node: WorkflowNode,
  lastNodeId: string | null
) {
  nodes.push(node)
  if (lastNodeId) {
    edges.push({
      id: `e-${lastNodeId}-${node.id}`,
      source: lastNodeId,
      target: node.id,
    })
  }
}

function preview(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function formatDuration(firstTimestamp: string, lastTimestamp: string): string {
  if (!firstTimestamp || !lastTimestamp) return '0s'

  const ms = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '0s'

  const mins = ms / 60000
  if (mins < 1) return `${Math.round(ms / 1000)}s`
  if (mins < 60) return `${Math.round(mins)}m`
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
}

function extractReasoningText(payload: Record<string, unknown>): string {
  const summary = payload.summary
  const summaryText = extractContentText(summary)
  if (summaryText) return summaryText
  const contentText = extractContentText(payload.content)
  if (contentText) return contentText
  return ''
}

function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return ''

        const block = item as Record<string, unknown>
        const text = normalizeText(block.text)
        if (text) return text

        const nested = normalizeText(block.content)
        if (nested) return nested

        if (block.type === 'input_image' || block.type === 'output_image') return '[image]'
        return ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return normalizeText(content)
}

function normalizeText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    return value.map((v) => normalizeText(v)).filter(Boolean).join('\n').trim()
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

function hasToolError(text: string): boolean {
  const lowered = text.toLowerCase()
  return (
    /process exited with code [1-9]/.test(lowered) ||
    /"exit_code"\s*:\s*[1-9]/.test(lowered) ||
    lowered.includes('error') ||
    lowered.includes('exception')
  )
}
