import { prisma } from './db'
import type {
  UsageData,
  SessionSummary,
  ProjectSummary,
  DailyUsage,
  OverviewStats,
} from './parse-logs'

export async function getUsageData(): Promise<UsageData> {
  const dbSessions = await prisma.session.findMany({
    orderBy: { startTime: 'desc' },
  })

  if (dbSessions.length === 0) {
    return emptyUsageData()
  }

  // Map DB rows to SessionSummary
  const sessions: SessionSummary[] = dbSessions.map((s) => ({
    sessionId: s.sessionId,
    project: s.project,
    projectPath: s.projectPath,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    durationMinutes: s.durationMinutes,
    userMessages: s.userMessages,
    assistantMessages: s.assistantMessages,
    totalMessages: s.totalMessages,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    cacheCreationTokens: s.cacheCreationTokens,
    cacheReadTokens: s.cacheReadTokens,
    totalTokens: s.totalTokens,
    costUSD: s.costUSD,
    model: s.model,
    toolCalls: JSON.parse(s.toolCallsJson) as Record<string, number>,
    toolCallsTotal: s.toolCallsTotal,
    messageTimestamps: JSON.parse(s.messageTimestamps) as string[],
    skillCalls: JSON.parse(s.skillCallsJson) as Record<string, number>,
    apiErrors: s.apiErrors,
    rateLimitErrors: s.rateLimitErrors,
    userInterruptions: s.userInterruptions,
    permissionModes: JSON.parse(s.permissionModesJson || '{}') as Record<string, number>,
    systemPromptEdits: s.systemPromptEdits,
  }))

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
      })
    }
    const daily = dailyMap.get(date)!
    daily.sessions++
    daily.messages += s.totalMessages
    daily.userMessages += s.userMessages
    daily.assistantMessages += s.assistantMessages
    daily.inputTokens += s.inputTokens
    daily.outputTokens += s.outputTokens
    daily.cacheCreationTokens += s.cacheCreationTokens
    daily.cacheReadTokens += s.cacheReadTokens
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

  const dailyArr = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const projects = Array.from(projectMap.values()).sort((a, b) => b.totalCost - a.totalCost)

  const models: Record<string, number> = {}
  const skillUsage: Record<string, number> = {}
  const permissionModes: Record<string, number> = {}
  for (const s of sessions) {
    models[s.model] = (models[s.model] || 0) + 1
    for (const [skill, count] of Object.entries(s.skillCalls)) {
      skillUsage[skill] = (skillUsage[skill] || 0) + count
    }
    for (const [mode, count] of Object.entries(s.permissionModes)) {
      permissionModes[mode] = (permissionModes[mode] || 0) + count
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
    totalApiErrors: sessions.reduce((a, s) => a + s.apiErrors, 0),
    totalRateLimitDays: (() => {
      const days = new Set<string>()
      for (const s of sessions) {
        if (s.rateLimitErrors > 0) days.add(s.startTime.slice(0, 10))
      }
      return days.size
    })(),
    totalUserInterruptions: sessions.reduce((a, s) => a + s.userInterruptions, 0),
    totalSystemPromptEdits: sessions.reduce((a, s) => a + s.systemPromptEdits, 0),
    models,
    skillUsage,
    permissionModes,
  }

  return { overview, sessions, projects, daily: dailyArr, toolUsage }
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
