import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadPricing, calculateCost, type ModelPricing } from './pricing'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

// ─── Types ───────────────────────────────────────────────────────────

export interface SessionSummary {
  sessionId: string
  project: string
  projectPath: string // original path decoded from dir name
  startTime: string
  endTime: string
  durationMinutes: number
  userMessages: number
  assistantMessages: number
  totalMessages: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  costUSD: number
  model: string
  modelCounts: Record<string, number> // per-message model counts
  toolCalls: Record<string, number>
  toolCallsTotal: number
  skillCalls: Record<string, number>
  messageTimestamps?: string[] // ISO timestamps of each message
  apiErrors: number
  rateLimitErrors: number
  userInterruptions: number
  permissionModes: Record<string, number> // default, acceptEdits, bypassPermissions, plan
  systemPromptEdits: number // edits/writes to CLAUDE.md, AGENTS.md, agent.md
  cliVersion: string // Claude Code CLI version from JSONL logs
}

export interface ProjectSummary {
  name: string
  path: string
  sessions: number
  totalMessages: number
  totalTokens: number
  totalCost: number
  totalDurationMinutes: number
  toolCalls: Record<string, number>
}

export interface ModelBreakdown {
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUSD: number
}

export interface DailyUsage {
  date: string
  sessions: number
  messages: number
  userMessages: number
  assistantMessages: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  costUSD: number
  toolCalls: number
  toolCallsDetail: Record<string, number>
  interruptions: number
  rateLimitErrors: number
  modelBreakdowns: ModelBreakdown[]
}

export interface OverviewStats {
  totalSessions: number
  totalProjects: number
  totalMessages: number
  totalUserMessages: number
  totalAssistantMessages: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  totalTokens: number
  totalCostUSD: number
  totalDurationMinutes: number
  totalToolCalls: number
  totalApiErrors: number
  totalRateLimitDays: number
  totalUserInterruptions: number
  totalSystemPromptEdits: number
  models: Record<string, number>
  skillUsage: Record<string, number>
  permissionModes: Record<string, number>
}

export interface UsageData {
  overview: OverviewStats
  sessions: SessionSummary[]
  projects: ProjectSummary[]
  daily: DailyUsage[]
  toolUsage: Record<string, number>
}

// ─── Parsing ─────────────────────────────────────────────────────────

function decodeProjectPath(dirName: string): string {
  return dirName.replace(/-/g, '/')
}

function getProjectName(projectPath: string): string {
  // The decoded path may be wrong if the actual folder name contains dashes,
  // since decodeProjectPath replaces ALL dashes with slashes.
  // Try merging trailing segments to find the real directory on disk.
  if (fs.existsSync(projectPath)) {
    return path.basename(projectPath)
  }
  const parts = projectPath.split('/')
  for (let merge = 2; merge <= Math.min(parts.length, 6); merge++) {
    const parentParts = parts.slice(0, -merge)
    const nameParts = parts.slice(-merge)
    const candidateName = nameParts.join('-')
    const candidatePath = [...parentParts, candidateName].join('/')
    if (fs.existsSync(candidatePath)) {
      return candidateName
    }
  }
  // Fallback: last segment
  return parts[parts.length - 1] || parts[parts.length - 2] || projectPath
}

interface LogEntry {
  type?: string
  version?: string
  message?: {
    role?: string
    content?: unknown[]
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
  timestamp?: string
  uuid?: string
}

function parseSessionFile(
  filePath: string,
  allPricing: Record<string, ModelPricing>
): SessionSummary | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n')

    let userMessages = 0
    let assistantMessages = 0
    let inputTokens = 0
    let outputTokens = 0
    let cacheCreationTokens = 0
    let cacheReadTokens = 0
    let costUSD = 0
    let currentModel = '' // tracks model for cost calculation per message
    const modelCounts: Record<string, number> = {} // count messages per model
    let startTime = ''
    let endTime = ''
    const toolCalls: Record<string, number> = {}
    const permissionModes: Record<string, number> = {}
    let systemPromptEdits = 0
    let cliVersion = ''

    for (const line of lines) {
      if (!line.trim()) continue
      let entry: LogEntry
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

      if (entry.version && !cliVersion) {
        cliVersion = entry.version
      }

      if (entry.type === 'user') {
        userMessages++
        // Track permission mode
        const pm = (entry as Record<string, unknown>).permissionMode as string | undefined
        if (pm) {
          permissionModes[pm] = (permissionModes[pm] || 0) + 1
        }
      } else if (entry.type === 'assistant' && entry.message) {
        assistantMessages++
        const msg = entry.message

        // Model
        if (msg.model && msg.model !== '<synthetic>') {
          currentModel = msg.model
          modelCounts[msg.model] = (modelCounts[msg.model] || 0) + 1
        }

        // Usage
        if (msg.usage) {
          const u = msg.usage
          inputTokens += u.input_tokens || 0
          outputTokens += u.output_tokens || 0
          cacheCreationTokens += u.cache_creation_input_tokens || 0
          cacheReadTokens += u.cache_read_input_tokens || 0

          if (currentModel) {
            costUSD += calculateCost(currentModel, u, allPricing)
          }
        }

        // Tool calls
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (
              block &&
              typeof block === 'object' &&
              'type' in block &&
              (block as Record<string, unknown>).type === 'tool_use'
            ) {
              const b = block as Record<string, unknown>
              const toolName = b.name as string
              if (toolName) {
                toolCalls[toolName] = (toolCalls[toolName] || 0) + 1
                // Detect system prompt file edits (CLAUDE.md, AGENTS.md, agent.md)
                if ((toolName === 'Edit' || toolName === 'Write') && b.input && typeof b.input === 'object') {
                  const filePath = (b.input as Record<string, unknown>).file_path as string
                  if (filePath && /\/(CLAUDE|AGENTS|agent)\.md$/i.test(filePath)) {
                    systemPromptEdits++
                  }
                }
              }
            }
          }
        }
      }
    }

    if (userMessages === 0 && assistantMessages === 0) return null

    const durationMinutes =
      startTime && endTime
        ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
        : 0

    const sessionId = path.basename(filePath, '.jsonl')

    return {
      sessionId,
      project: '',
      projectPath: '',
      startTime,
      endTime,
      durationMinutes: Math.max(0, durationMinutes),
      userMessages,
      assistantMessages,
      totalMessages: userMessages + assistantMessages,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
      costUSD,
      model: Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
      modelCounts,
      toolCalls,
      toolCallsTotal: Object.values(toolCalls).reduce((a, b) => a + b, 0),
      skillCalls: {},
      apiErrors: 0,
      rateLimitErrors: 0,
      userInterruptions: 0,
      permissionModes,
      systemPromptEdits,
      cliVersion: cliVersion || 'unknown',
    }
  } catch {
    return null
  }
}

export async function parseAllLogs(): Promise<UsageData> {
  const allPricing = await loadPricing()

  if (!fs.existsSync(PROJECTS_DIR)) {
    return emptyUsageData()
  }

  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
    return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory()
  })

  const sessions: SessionSummary[] = []
  const projectMap = new Map<string, ProjectSummary>()
  const dailyMap = new Map<string, DailyUsage>()
  const toolUsage: Record<string, number> = {}

  for (const dir of projectDirs) {
    const projectPath = decodeProjectPath(dir)
    const projectName = getProjectName(projectPath)
    const dirPath = path.join(PROJECTS_DIR, dir)

    const jsonlFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'))

    for (const file of jsonlFiles) {
      const session = parseSessionFile(path.join(dirPath, file), allPricing)
      if (!session) continue

      session.project = projectName
      session.projectPath = projectPath
      sessions.push(session)

      // Aggregate project stats
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, {
          name: projectName,
          path: projectPath,
          sessions: 0,
          totalMessages: 0,
          totalTokens: 0,
          totalCost: 0,
          totalDurationMinutes: 0,
          toolCalls: {},
        })
      }
      const proj = projectMap.get(projectName)!
      proj.sessions++
      proj.totalMessages += session.totalMessages
      proj.totalTokens += session.totalTokens
      proj.totalCost += session.costUSD
      proj.totalDurationMinutes += session.durationMinutes
      for (const [tool, count] of Object.entries(session.toolCalls)) {
        proj.toolCalls[tool] = (proj.toolCalls[tool] || 0) + count
      }

      // Aggregate daily stats
      if (session.startTime) {
        const date = session.startTime.slice(0, 10)
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            sessions: 0,
            messages: 0,
            userMessages: 0,
            assistantMessages: 0,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 0,
            costUSD: 0,
            toolCalls: 0,
            toolCallsDetail: {},
            interruptions: 0,
            rateLimitErrors: 0,
            modelBreakdowns: [],
          })
        }
        const daily = dailyMap.get(date)!
        daily.sessions++
        daily.messages += session.totalMessages
        daily.userMessages += session.userMessages
        daily.assistantMessages += session.assistantMessages
        daily.inputTokens += session.inputTokens
        daily.outputTokens += session.outputTokens
        daily.cacheCreationTokens += session.cacheCreationTokens
        daily.cacheReadTokens += session.cacheReadTokens
        daily.totalTokens += session.totalTokens
        daily.costUSD += session.costUSD
        daily.toolCalls += session.toolCallsTotal
        daily.interruptions += session.userInterruptions
        daily.rateLimitErrors += session.rateLimitErrors
        for (const [tool, count] of Object.entries(session.toolCalls)) {
          daily.toolCallsDetail[tool] = (daily.toolCallsDetail[tool] || 0) + count
        }
      }

      // Aggregate tool usage
      for (const [tool, count] of Object.entries(session.toolCalls)) {
        toolUsage[tool] = (toolUsage[tool] || 0) + count
      }
    }
  }

  // Sort sessions by start time desc
  sessions.sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''))

  // Build daily array sorted by date
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  // Build projects array sorted by cost desc
  const projects = Array.from(projectMap.values()).sort((a, b) => b.totalCost - a.totalCost)

  // Build overview — aggregate model counts at message level
  const models: Record<string, number> = {}
  for (const s of sessions) {
    for (const [m, count] of Object.entries(s.modelCounts)) {
      models[m] = (models[m] || 0) + count
    }
  }

  const overview: OverviewStats = {
    totalSessions: sessions.length,
    totalProjects: projects.length,
    totalMessages: sessions.reduce((a, s) => a + s.totalMessages, 0),
    totalUserMessages: sessions.reduce((a, s) => a + s.userMessages, 0),
    totalAssistantMessages: sessions.reduce((a, s) => a + s.assistantMessages, 0),
    totalInputTokens: sessions.reduce((a, s) => a + s.inputTokens, 0),
    totalOutputTokens: sessions.reduce((a, s) => a + s.outputTokens, 0),
    totalCacheCreationTokens: sessions.reduce((a, s) => a + s.cacheCreationTokens, 0),
    totalCacheReadTokens: sessions.reduce((a, s) => a + s.cacheReadTokens, 0),
    totalTokens: sessions.reduce((a, s) => a + s.totalTokens, 0),
    totalCostUSD: sessions.reduce((a, s) => a + s.costUSD, 0),
    totalDurationMinutes: sessions.reduce((a, s) => a + s.durationMinutes, 0),
    totalToolCalls: sessions.reduce((a, s) => a + s.toolCallsTotal, 0),
    totalApiErrors: 0,
    totalRateLimitDays: 0,
    totalUserInterruptions: 0,
    totalSystemPromptEdits: sessions.reduce((a, s) => a + s.systemPromptEdits, 0),
    models,
    skillUsage: {},
    permissionModes: {},
  }

  return { overview, sessions, projects, daily, toolUsage }
}

function emptyUsageData(): UsageData {
  return {
    overview: {
      totalSessions: 0,
      totalProjects: 0,
      totalMessages: 0,
      totalUserMessages: 0,
      totalAssistantMessages: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalTokens: 0,
      totalCostUSD: 0,
      totalDurationMinutes: 0,
      totalToolCalls: 0,
      totalApiErrors: 0,
      totalRateLimitDays: 0,
      totalUserInterruptions: 0,
      totalSystemPromptEdits: 0,
      models: {},
      skillUsage: {},
      permissionModes: {},
    },
    sessions: [],
    projects: [],
    daily: [],
    toolUsage: {},
  }
}
