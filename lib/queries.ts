import { prisma } from './db'
import type {
  UsageData,
  SessionSummary,
  ProjectSummary,
  DailyUsage,
  ModelBreakdown,
  OverviewStats,
} from './parse-logs'

export async function getUsageData(): Promise<UsageData> {
  const [dbSessions, dbMessageUsages] = await Promise.all([
    prisma.session.findMany({ orderBy: { startTime: 'desc' } }),
    prisma.messageUsage.findMany({
      select: {
        date: true,
        model: true,
        speed: true,
        inputTokens: true,
        outputTokens: true,
        cacheCreationTokens: true,
        cacheReadTokens: true,
        costUSD: true,
      },
    }),
  ])

  if (dbSessions.length === 0 && dbMessageUsages.length === 0) {
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
    cliVersion: s.cliVersion,
    modelCounts: JSON.parse(s.modelCountsJson || '{}') as Record<string, number>,
  }))

  // Aggregate projects (per-session — unaffected by message-level dedup since
  // a session belongs to one project)
  const projectMap = new Map<string, ProjectSummary>()
  const toolUsage: Record<string, number> = {}

  for (const s of sessions) {
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
    for (const [tool, count] of Object.entries(s.toolCalls)) {
      toolUsage[tool] = (toolUsage[tool] || 0) + count
    }
  }

  // Daily aggregation comes from MessageUsage so totals match ccusage:
  //   • per-message timestamp → correct date bucket across midnight
  //   • (messageId, requestId) dedup → no double-counting on session resumes
  //   • per-(date, model) breakdown → opus + haiku stack on the same day
  // Mirrors ccusage data-loader.ts:760-901 (loadDailyUsageData).
  const dailyMap = new Map<string, DailyUsage>()
  const breakdownMap = new Map<string, Map<string, ModelBreakdown>>()

  for (const m of dbMessageUsages) {
    if (!dailyMap.has(m.date)) {
      dailyMap.set(m.date, {
        date: m.date,
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
      breakdownMap.set(m.date, new Map())
    }
    const d = dailyMap.get(m.date)!
    d.inputTokens += m.inputTokens
    d.outputTokens += m.outputTokens
    d.cacheCreationTokens += m.cacheCreationTokens
    d.cacheReadTokens += m.cacheReadTokens
    d.totalTokens +=
      m.inputTokens + m.outputTokens + m.cacheCreationTokens + m.cacheReadTokens
    d.costUSD += m.costUSD

    const modelKey = m.speed === 'fast' ? `${m.model}-fast` : m.model
    const perModel = breakdownMap.get(m.date)!
    if (!perModel.has(modelKey)) {
      perModel.set(modelKey, {
        model: modelKey,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUSD: 0,
      })
    }
    const mb = perModel.get(modelKey)!
    mb.inputTokens += m.inputTokens
    mb.outputTokens += m.outputTokens
    mb.cacheCreationTokens += m.cacheCreationTokens
    mb.cacheReadTokens += m.cacheReadTokens
    mb.costUSD += m.costUSD
  }

  // Layer per-session counters that MessageUsage doesn't track: sessions count,
  // user/assistant message counts, tool calls, interruptions.
  for (const s of sessions) {
    const date = s.startTime.slice(0, 10)
    let d = dailyMap.get(date)
    if (!d) {
      d = {
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
      }
      dailyMap.set(date, d)
      breakdownMap.set(date, new Map())
    }
    d.sessions++
    d.messages += s.totalMessages
    d.userMessages += s.userMessages
    d.assistantMessages += s.assistantMessages
    d.toolCalls += s.toolCallsTotal
    d.interruptions += s.userInterruptions
    d.rateLimitErrors += s.rateLimitErrors
    for (const [tool, count] of Object.entries(s.toolCalls)) {
      d.toolCallsDetail[tool] = (d.toolCallsDetail[tool] || 0) + count
    }
  }

  for (const [date, perModel] of breakdownMap) {
    dailyMap.get(date)!.modelBreakdowns = Array.from(perModel.values()).sort((a, b) =>
      a.model.localeCompare(b.model)
    )
  }

  const dailyArr = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const projects = Array.from(projectMap.values()).sort((a, b) => b.totalCost - a.totalCost)

  const models: Record<string, number> = {}
  const skillUsage: Record<string, number> = {}
  const permissionModes: Record<string, number> = {}
  for (const s of sessions) {
    for (const [m, count] of Object.entries(s.modelCounts)) {
      models[m] = (models[m] || 0) + count
    }
    for (const [skill, count] of Object.entries(s.skillCalls)) {
      skillUsage[skill] = (skillUsage[skill] || 0) + count
    }
    for (const [mode, count] of Object.entries(s.permissionModes)) {
      permissionModes[mode] = (permissionModes[mode] || 0) + count
    }
  }

  // Overview token + cost totals come from the deduped MessageUsage rows so
  // the overview matches the daily breakdown (which also reads MessageUsage).
  const tokenTotals = dailyArr.reduce(
    (acc, d) => ({
      input: acc.input + d.inputTokens,
      output: acc.output + d.outputTokens,
      cc: acc.cc + d.cacheCreationTokens,
      cr: acc.cr + d.cacheReadTokens,
      cost: acc.cost + d.costUSD,
    }),
    { input: 0, output: 0, cc: 0, cr: 0, cost: 0 }
  )

  const overview: OverviewStats = {
    totalSessions: sessions.length,
    totalProjects: projects.length,
    totalMessages: sessions.reduce((a, s) => a + s.totalMessages, 0),
    totalUserMessages: sessions.reduce((a, s) => a + s.userMessages, 0),
    totalAssistantMessages: sessions.reduce((a, s) => a + s.assistantMessages, 0),
    totalInputTokens: tokenTotals.input,
    totalOutputTokens: tokenTotals.output,
    totalCacheCreationTokens: tokenTotals.cc,
    totalCacheReadTokens: tokenTotals.cr,
    totalTokens: tokenTotals.input + tokenTotals.output + tokenTotals.cc + tokenTotals.cr,
    totalCostUSD: tokenTotals.cost,
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
