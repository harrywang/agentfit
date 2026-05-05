// ─── Codex Usage Data Queries ────────────────────────────────────────
// Produces UsageData from Codex session logs (no database, parsed live)

import { parseAllCodexSessions } from './parse-codex'
import type {
  UsageData,
  ProjectSummary,
  DailyUsage,
  OverviewStats,
} from './parse-logs'

export function getCodexUsageData(): UsageData {
  const sessions = parseAllCodexSessions()

  if (sessions.length === 0) {
    return emptyUsageData()
  }

  // Aggregate projects
  const projectMap = new Map<string, ProjectSummary>()
  const dailyMap = new Map<string, DailyUsage>()
  const toolUsage: Record<string, number> = {}

  for (const s of sessions) {
    // Projects
    if (!projectMap.has(s.project)) {
      projectMap.set(s.project, {
        name: s.project,
        path: s.projectPath,
        sessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
        totalDurationMinutes: 0,
        toolCalls: {},
      })
    }
    const proj = projectMap.get(s.project)!
    proj.sessions++
    proj.totalMessages += s.totalMessages
    proj.totalTokens += s.totalTokens
    proj.totalCost += s.costUSD
    proj.totalDurationMinutes += s.durationMinutes
    for (const [tool, count] of Object.entries(s.toolCalls)) {
      proj.toolCalls[tool] = (proj.toolCalls[tool] || 0) + count
    }

    // Daily
    const date = s.startTime.slice(0, 10)
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
    daily.messages += s.totalMessages
    daily.userMessages += s.userMessages
    daily.assistantMessages += s.assistantMessages
    daily.inputTokens += s.inputTokens
    daily.outputTokens += s.outputTokens
    daily.totalTokens += s.totalTokens
    daily.costUSD += s.costUSD
    daily.toolCalls += s.toolCallsTotal
    daily.interruptions += s.userInterruptions
    daily.rateLimitErrors += s.rateLimitErrors
    for (const [tool, count] of Object.entries(s.toolCalls)) {
      daily.toolCallsDetail[tool] = (daily.toolCallsDetail[tool] || 0) + count
    }

    // Tool usage
    for (const [tool, count] of Object.entries(s.toolCalls)) {
      toolUsage[tool] = (toolUsage[tool] || 0) + count
    }
  }

  const models: Record<string, number> = {}
  for (const s of sessions) {
    models[s.model] = (models[s.model] || 0) + 1
  }

  const projects = Array.from(projectMap.values()).sort((a, b) => b.totalCost - a.totalCost)
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const overview: OverviewStats = {
    totalSessions: sessions.length,
    totalProjects: projects.length,
    totalMessages: sessions.reduce((a, s) => a + s.totalMessages, 0),
    totalUserMessages: sessions.reduce((a, s) => a + s.userMessages, 0),
    totalAssistantMessages: sessions.reduce((a, s) => a + s.assistantMessages, 0),
    totalInputTokens: sessions.reduce((a, s) => a + s.inputTokens, 0),
    totalOutputTokens: sessions.reduce((a, s) => a + s.outputTokens, 0),
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    totalTokens: sessions.reduce((a, s) => a + s.totalTokens, 0),
    totalCostUSD: sessions.reduce((a, s) => a + s.costUSD, 0),
    totalDurationMinutes: sessions.reduce((a, s) => a + s.durationMinutes, 0),
    totalToolCalls: sessions.reduce((a, s) => a + s.toolCallsTotal, 0),
    totalApiErrors: 0,
    totalRateLimitDays: 0,
    totalUserInterruptions: 0,
    totalSystemPromptEdits: 0,
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
