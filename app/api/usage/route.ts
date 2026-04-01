import { NextRequest, NextResponse } from 'next/server'
import { getUsageData } from '@/lib/queries'
import { getCodexUsageData } from '@/lib/queries-codex'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const agent = request.nextUrl.searchParams.get('agent') || 'claude'

    if (agent === 'codex') {
      const data = getCodexUsageData()
      return NextResponse.json(data)
    }

    if (agent === 'combined') {
      const [claudeData, codexData] = await Promise.all([
        getUsageData(),
        Promise.resolve(getCodexUsageData()),
      ])
      const merged = mergeUsageData(claudeData, codexData)
      return NextResponse.json(merged)
    }

    // Default: claude
    const data = await getUsageData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to query usage data:', error)
    return NextResponse.json({ error: 'Failed to query usage data' }, { status: 500 })
  }
}

// ─── Merge two UsageData objects ─────────────────────────────────────

import type { UsageData } from '@/lib/parse-logs'

function mergeUsageData(a: UsageData, b: UsageData): UsageData {
  const sessions = [...a.sessions, ...b.sessions].sort(
    (x, y) => (y.startTime || '').localeCompare(x.startTime || '')
  )

  // Merge projects
  const projectMap = new Map<string, (typeof a.projects)[0]>()
  for (const proj of [...a.projects, ...b.projects]) {
    const existing = projectMap.get(proj.name)
    if (existing) {
      existing.sessions += proj.sessions
      existing.totalMessages += proj.totalMessages
      existing.totalTokens += proj.totalTokens
      existing.totalCost += proj.totalCost
      existing.totalDurationMinutes += proj.totalDurationMinutes
      for (const [tool, count] of Object.entries(proj.toolCalls)) {
        existing.toolCalls[tool] = (existing.toolCalls[tool] || 0) + count
      }
    } else {
      projectMap.set(proj.name, { ...proj, toolCalls: { ...proj.toolCalls } })
    }
  }

  // Merge daily
  const dailyMap = new Map<string, (typeof a.daily)[0]>()
  for (const day of [...a.daily, ...b.daily]) {
    const existing = dailyMap.get(day.date)
    if (existing) {
      existing.sessions += day.sessions
      existing.messages += day.messages
      existing.userMessages += day.userMessages
      existing.assistantMessages += day.assistantMessages
      existing.inputTokens += day.inputTokens
      existing.outputTokens += day.outputTokens
      existing.cacheCreationTokens += day.cacheCreationTokens
      existing.cacheReadTokens += day.cacheReadTokens
      existing.totalTokens += day.totalTokens
      existing.costUSD += day.costUSD
      existing.toolCalls += day.toolCalls
      existing.interruptions += day.interruptions
      existing.rateLimitErrors += day.rateLimitErrors
      for (const [tool, count] of Object.entries(day.toolCallsDetail)) {
        existing.toolCallsDetail[tool] = (existing.toolCallsDetail[tool] || 0) + count
      }
    } else {
      dailyMap.set(day.date, { ...day, toolCallsDetail: { ...day.toolCallsDetail } })
    }
  }

  // Merge tool usage
  const toolUsage: Record<string, number> = { ...a.toolUsage }
  for (const [tool, count] of Object.entries(b.toolUsage)) {
    toolUsage[tool] = (toolUsage[tool] || 0) + count
  }

  // Merge models
  const models: Record<string, number> = { ...a.overview.models }
  for (const [m, count] of Object.entries(b.overview.models)) {
    models[m] = (models[m] || 0) + count
  }

  const projects = Array.from(projectMap.values()).sort((x, y) => y.totalCost - x.totalCost)
  const daily = Array.from(dailyMap.values()).sort((x, y) => x.date.localeCompare(y.date))

  return {
    overview: {
      totalSessions: a.overview.totalSessions + b.overview.totalSessions,
      totalProjects: projects.length,
      totalMessages: a.overview.totalMessages + b.overview.totalMessages,
      totalUserMessages: a.overview.totalUserMessages + b.overview.totalUserMessages,
      totalAssistantMessages: a.overview.totalAssistantMessages + b.overview.totalAssistantMessages,
      totalInputTokens: a.overview.totalInputTokens + b.overview.totalInputTokens,
      totalOutputTokens: a.overview.totalOutputTokens + b.overview.totalOutputTokens,
      totalCacheCreationTokens: a.overview.totalCacheCreationTokens + b.overview.totalCacheCreationTokens,
      totalCacheReadTokens: a.overview.totalCacheReadTokens + b.overview.totalCacheReadTokens,
      totalTokens: a.overview.totalTokens + b.overview.totalTokens,
      totalCostUSD: a.overview.totalCostUSD + b.overview.totalCostUSD,
      totalDurationMinutes: a.overview.totalDurationMinutes + b.overview.totalDurationMinutes,
      totalToolCalls: a.overview.totalToolCalls + b.overview.totalToolCalls,
      totalApiErrors: a.overview.totalApiErrors + b.overview.totalApiErrors,
      totalRateLimitDays: a.overview.totalRateLimitDays + b.overview.totalRateLimitDays,
      totalUserInterruptions: a.overview.totalUserInterruptions + b.overview.totalUserInterruptions,
      totalSystemPromptEdits: (a.overview.totalSystemPromptEdits ?? 0) + (b.overview.totalSystemPromptEdits ?? 0),
      models,
      skillUsage: (() => {
        const skills: Record<string, number> = { ...a.overview.skillUsage }
        for (const [s, c] of Object.entries(b.overview.skillUsage)) {
          skills[s] = (skills[s] || 0) + c
        }
        return skills
      })(),
      permissionModes: (() => {
        const modes: Record<string, number> = { ...(a.overview.permissionModes || {}) }
        for (const [m, c] of Object.entries(b.overview.permissionModes || {})) {
          modes[m] = (modes[m] || 0) + c
        }
        return modes
      })(),
    },
    sessions,
    projects,
    daily,
    toolUsage,
  }
}
