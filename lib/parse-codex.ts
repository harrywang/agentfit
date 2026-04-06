// ─── Codex CLI Log Parser ────────────────────────────────────────────
// Parses OpenAI Codex session logs from ~/.codex/sessions/
// Rollout format: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl

import fs from 'fs'
import path from 'path'
import os from 'os'
import type { SessionSummary } from './parse-logs'

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
const SESSIONS_DIR = path.join(CODEX_HOME, 'sessions')

// ─── Codex Log Entry Types ──────────────────────────────────────────

interface CodexEntry {
  timestamp: string
  type: 'session_meta' | 'event_msg' | 'response_item' | 'turn_context'
  payload: Record<string, unknown>
}

// ─── Session Parsing ─────────────────────────────────────────────────

function getProjectName(cwd: string): string {
  const parts = cwd.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || cwd
}

export function parseCodexSession(filePath: string): SessionSummary | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n')

    let sessionId = ''
    let project = ''
    let projectPath = ''
    let model = 'unknown'
    let startTime = ''
    let endTime = ''
    let userMessages = 0
    let assistantMessages = 0
    const toolCalls: Record<string, number> = {}

    // Codex doesn't expose per-message token counts in rollout files,
    // so we estimate from message counts. Codex uses GPT-5 models which
    // don't break down cache tokens the same way.
    let inputTokens = 0
    let outputTokens = 0

    for (const line of lines) {
      if (!line.trim()) continue
      let entry: CodexEntry
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }

      // Track timestamps
      if (entry.timestamp) {
        if (!startTime) startTime = entry.timestamp
        endTime = entry.timestamp
      }

      const payload = entry.payload || {}

      switch (entry.type) {
        case 'session_meta':
          sessionId = (payload.id as string) || ''
          projectPath = (payload.cwd as string) || ''
          project = getProjectName(projectPath)
          break

        case 'turn_context':
          model = (payload.model as string) || model
          break

        case 'response_item': {
          const role = payload.role as string | undefined
          const ptype = payload.type as string

          if (role === 'user') {
            userMessages++
            // Estimate input tokens from user message content
            const content = payload.content as Array<{ text?: string }> | undefined
            if (content) {
              for (const block of content) {
                if (block.text) {
                  inputTokens += Math.round(block.text.length / 4) // rough estimate
                }
              }
            }
          } else if (role === 'assistant') {
            assistantMessages++
            // Estimate output tokens from assistant message content
            const content = payload.content as Array<{ text?: string }> | undefined
            if (content) {
              for (const block of content) {
                if (block.text) {
                  outputTokens += Math.round(block.text.length / 4)
                }
              }
            }
          }

          if (ptype === 'function_call') {
            const toolName = (payload.name as string) || 'unknown'
            toolCalls[toolName] = (toolCalls[toolName] || 0) + 1
          }
          break
        }

        case 'event_msg': {
          const eventType = payload.type as string
          if (eventType === 'user_message') {
            userMessages++
            const text = (payload as Record<string, unknown>).text as string | undefined
            if (text) {
              inputTokens += Math.round(text.length / 4)
            }
          }
          break
        }
      }
    }

    if (userMessages === 0 && assistantMessages === 0) return null

    // Use filename-based session ID if not found in meta
    if (!sessionId) {
      const basename = path.basename(filePath, '.jsonl')
      const match = basename.match(/rollout-[\dT-]+-(.+)/)
      sessionId = match ? match[1] : basename
    }

    const durationMinutes =
      startTime && endTime
        ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
        : 0

    const totalTokens = inputTokens + outputTokens

    return {
      sessionId: `codex-${sessionId}`,
      project,
      projectPath,
      startTime,
      endTime,
      durationMinutes: Math.max(0, durationMinutes),
      userMessages,
      assistantMessages,
      totalMessages: userMessages + assistantMessages,
      inputTokens,
      outputTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens,
      costUSD: 0, // Codex doesn't expose per-session costs in logs
      model: model || 'gpt-5',
      toolCalls,
      toolCallsTotal: Object.values(toolCalls).reduce((a, b) => a + b, 0),
      skillCalls: {},
      apiErrors: 0,
      rateLimitErrors: 0,
      userInterruptions: 0,
      systemPromptEdits: 0,
      permissionModes: {},
      cliVersion: 'codex',
    }
  } catch {
    return null
  }
}

// ─── Discover and Parse All Sessions ─────────────────────────────────

export function parseAllCodexSessions(): SessionSummary[] {
  if (!fs.existsSync(SESSIONS_DIR)) return []

  const sessions: SessionSummary[] = []
  const files = findJsonlFiles(SESSIONS_DIR)

  for (const file of files) {
    const session = parseCodexSession(file)
    if (session) sessions.push(session)
  }

  return sessions.sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''))
}

function findJsonlFiles(dir: string): string[] {
  const results: string[] = []

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findJsonlFiles(fullPath))
      } else if (entry.name.endsWith('.jsonl') && entry.name.startsWith('rollout-')) {
        results.push(fullPath)
      }
    }
  } catch {
    // Permission errors, etc.
  }

  return results
}
