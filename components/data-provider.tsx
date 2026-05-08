'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { UsageData, SessionSummary, DailyUsage, ProjectSummary, OverviewStats } from '@/lib/parse-logs'

export type AgentType = 'claude' | 'codex' | 'combined'
export type TimeRange = '7d' | '30d' | '90d' | 'all'

interface SyncResult {
  sessionsAdded: number
  sessionsSkipped: number
  filesProcessed: number
  imagesExtracted: number
  errors: number
}

interface DataContextValue {
  data: UsageData | null
  loading: boolean
  error: string | null
  agent: AgentType
  setAgent: (agent: AgentType) => void
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void
  selectedProject: string
  setSelectedProject: (project: string) => void
  allProjects: string[]
  syncing: boolean
  resetting: boolean
  lastSyncResult: SyncResult | null
  lastSyncTime: Date | null
  handleSync: () => Promise<void>
  handleReset: () => Promise<void>
  newSessionsAvailable: number
}

const DataContext = createContext<DataContextValue | null>(null)

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

const RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  'all': Infinity,
}

// Local-timezone YYYY-MM-DD, matching ccusage's _date-utils.ts and
// lib/sync.ts (Intl.DateTimeFormat('en-CA')). UTC ISO slicing would shift
// cross-midnight events to the wrong day and break parity with ccusage.
function localDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function filterData(raw: UsageData | null, range: TimeRange, project: string): UsageData | null {
  if (!raw) return raw
  if (range === 'all' && project === 'all') return raw

  const days = RANGE_DAYS[range]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = range === 'all' ? '' : cutoff.toISOString()
  const cutoffDate = range === 'all' ? '' : localDateString(cutoff)

  // Filter sessions by time range and project
  const sessions = raw.sessions.filter(s => {
    if (range !== 'all' && s.startTime < cutoffISO) return false
    if (project !== 'all' && s.project !== project) return false
    return true
  })

  // Daily: preserve the server's per-message-derived rows (with
  // modelBreakdowns intact, including haiku/sub-agent tokens) when the
  // project filter is inactive — only trim by date. Re-aggregating from
  // session rollups loses the per-(date, model) split, mis-buckets
  // cross-midnight tokens, and can drift from ccusage. When a project
  // filter IS active we have no choice but to rebuild from sessions, since
  // per-message rows aren't tagged by project on the client.
  let daily: DailyUsage[]
  if (project === 'all') {
    daily = raw.daily
      .filter(d => range === 'all' || d.date >= cutoffDate)
      .map(d => ({ ...d, modelBreakdowns: [...d.modelBreakdowns] }))
  } else {
    const dailyMap = new Map<string, DailyUsage>()
    for (const s of sessions) {
      const date = localDateString(new Date(s.startTime))
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date, sessions: 0, messages: 0,
          userMessages: 0, assistantMessages: 0,
          inputTokens: 0, outputTokens: 0,
          cacheCreationTokens: 0, cacheReadTokens: 0,
          totalTokens: 0, costUSD: 0, toolCalls: 0,
          toolCallsDetail: {}, interruptions: 0, rateLimitErrors: 0,
          modelBreakdowns: [],
        })
      }
      const day = dailyMap.get(date)!
      day.sessions++
      day.messages += s.totalMessages
      day.userMessages += s.userMessages
      day.assistantMessages += s.assistantMessages
      day.inputTokens += s.inputTokens
      day.outputTokens += s.outputTokens
      day.cacheCreationTokens += s.cacheCreationTokens
      day.cacheReadTokens += s.cacheReadTokens
      day.totalTokens += s.totalTokens
      day.costUSD += s.costUSD
      day.toolCalls += s.toolCallsTotal
      day.interruptions += s.userInterruptions
      day.rateLimitErrors += s.rateLimitErrors
      for (const [tool, count] of Object.entries(s.toolCalls)) {
        day.toolCallsDetail[tool] = (day.toolCallsDetail[tool] || 0) + count
      }
    }
    daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  // Projects, tools, models, skills, permission modes — all derived from
  // the (already-filtered) sessions list and unchanged across the two daily
  // paths.
  const projectMap = new Map<string, ProjectSummary>()
  const toolUsage: Record<string, number> = {}
  const models: Record<string, number> = {}

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
      toolUsage[tool] = (toolUsage[tool] || 0) + count
    }
    for (const [m, count] of Object.entries(s.modelCounts || {})) {
      models[m] = (models[m] || 0) + count
    }
  }

  const projects = Array.from(projectMap.values()).sort((a, b) => b.totalCost - a.totalCost)

  // Overview token/cost totals come from the daily rows so the overview
  // and the daily breakdown agree (mirrors getUsageData on the server).
  const tokenTotals = daily.reduce(
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
    totalSystemPromptEdits: sessions.reduce((a, s) => a + (s.systemPromptEdits ?? 0), 0),
    totalDurationMinutes: sessions.reduce((a, s) => a + s.durationMinutes, 0),
    totalToolCalls: sessions.reduce((a, s) => a + s.toolCallsTotal, 0),
    totalApiErrors: sessions.reduce((a, s) => a + s.apiErrors, 0),
    totalRateLimitDays: (() => {
      const rateDays = new Set<string>()
      for (const s of sessions) {
        if (s.rateLimitErrors > 0) rateDays.add(localDateString(new Date(s.startTime)))
      }
      return rateDays.size
    })(),
    totalUserInterruptions: sessions.reduce((a, s) => a + s.userInterruptions, 0),
    models,
    skillUsage: (() => {
      const skills: Record<string, number> = {}
      for (const s of sessions) {
        for (const [skill, count] of Object.entries(s.skillCalls)) {
          skills[skill] = (skills[skill] || 0) + count
        }
      }
      return skills
    })(),
    permissionModes: (() => {
      const modes: Record<string, number> = {}
      for (const s of sessions) {
        for (const [mode, count] of Object.entries(s.permissionModes || {})) {
          modes[mode] = (modes[mode] || 0) + count
        }
      }
      return modes
    })(),
  }

  return { overview, sessions, projects, daily, toolUsage }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [rawData, setRawData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agent, setAgentState] = useState<AgentType>('claude')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [syncing, setSyncing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [newSessionsAvailable, setNewSessionsAvailable] = useState(0)

  const data = useMemo(() => filterData(rawData, timeRange, selectedProject), [rawData, timeRange, selectedProject])

  const allProjects = useMemo(() => {
    if (!rawData) return []
    return rawData.projects.map(p => p.name).sort((a, b) => a.localeCompare(b))
  }, [rawData])

  const fetchData = useCallback(async (selectedAgent: AgentType) => {
    try {
      const res = await fetch(`/api/usage?agent=${selectedAgent}`)
      const d = await res.json()
      setRawData(d)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      if (agent !== 'codex') {
        const res = await fetch('/api/sync', { method: 'POST' })
        const result: SyncResult = await res.json()
        setLastSyncResult(result)
        setLastSyncTime(new Date())
      } else {
        setLastSyncTime(new Date())
        setLastSyncResult(null)
      }
      await fetchData(agent)
      setNewSessionsAvailable(0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }, [fetchData, agent])

  const handleReset = useCallback(async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/reset', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Reset failed')
      }
      setLastSyncResult(body)
      setLastSyncTime(new Date())
      setNewSessionsAvailable(0)
      toast.success('Database reset complete', {
        description: `Re-imported ${body.sessionsAdded || 0} sessions from disk.`,
      })
      // Full reload to dashboard so all state is fresh
      setTimeout(() => { window.location.href = '/' }, 1500)
      return
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      toast.error('Reset failed', { description: msg })
    } finally {
      setResetting(false)
    }
  }, [fetchData, agent])

  const setAgent = useCallback((newAgent: AgentType) => {
    setAgentState(newAgent)
    fetchData(newAgent)
  }, [fetchData])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await handleSync()
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <DataContext.Provider value={{
      data, loading, error, agent, setAgent,
      timeRange, setTimeRange,
      selectedProject, setSelectedProject, allProjects,
      syncing, resetting, lastSyncResult, lastSyncTime, handleSync, handleReset,
      newSessionsAvailable,
    }}>
      {children}
    </DataContext.Provider>
  )
}
