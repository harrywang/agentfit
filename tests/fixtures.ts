/**
 * Shared test fixtures for community plugin tests.
 *
 * Use `createMockData()` to get a realistic UsageData object.
 * Customize by spreading overrides into the returned object.
 */
import type { UsageData, SessionSummary, DailyUsage, ProjectSummary, OverviewStats } from '@/lib/parse-logs'

export function createMockSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: 'sess-001',
    project: 'my-project',
    projectPath: '/Users/dev/my-project',
    startTime: '2025-03-20T10:00:00Z',
    endTime: '2025-03-20T10:30:00Z',
    durationMinutes: 30,
    userMessages: 5,
    assistantMessages: 5,
    totalMessages: 10,
    inputTokens: 5000,
    outputTokens: 2000,
    cacheCreationTokens: 1000,
    cacheReadTokens: 500,
    totalTokens: 8500,
    costUSD: 0.15,
    model: 'claude-sonnet-4-20250514',
    toolCalls: { Read: 3, Edit: 2, Bash: 1 },
    toolCallsTotal: 6,
    skillCalls: {},
    apiErrors: 0,
    rateLimitErrors: 0,
    userInterruptions: 0,
    systemPromptEdits: 0,
    permissionModes: {},
    cliVersion: '2.1.90',
    ...overrides,
  }
}

export function createMockDaily(overrides: Partial<DailyUsage> = {}): DailyUsage {
  return {
    date: '2025-03-20',
    sessions: 3,
    messages: 30,
    userMessages: 15,
    assistantMessages: 15,
    inputTokens: 15000,
    outputTokens: 6000,
    cacheCreationTokens: 3000,
    cacheReadTokens: 1500,
    totalTokens: 25500,
    costUSD: 0.45,
    toolCalls: 18,
    toolCallsDetail: { Read: 9, Edit: 6, Bash: 3 },
    interruptions: 0,
    rateLimitErrors: 0,
    ...overrides,
  }
}

export function createMockData(overrides: Partial<UsageData> = {}): UsageData {
  const sessions = [
    createMockSession({ sessionId: 'sess-001', startTime: '2025-03-18T10:00:00Z', costUSD: 0.10 }),
    createMockSession({ sessionId: 'sess-002', startTime: '2025-03-19T14:00:00Z', costUSD: 0.25 }),
    createMockSession({ sessionId: 'sess-003', startTime: '2025-03-20T09:00:00Z', costUSD: 0.50 }),
  ]

  const daily = [
    createMockDaily({ date: '2025-03-18', costUSD: 0.10, sessions: 1 }),
    createMockDaily({ date: '2025-03-19', costUSD: 0.25, sessions: 1 }),
    createMockDaily({ date: '2025-03-20', costUSD: 0.50, sessions: 1 }),
  ]

  const projects: ProjectSummary[] = [
    {
      name: 'my-project',
      path: '/Users/dev/my-project',
      sessions: 3,
      totalMessages: 30,
      totalTokens: 25500,
      totalCost: 0.85,
      totalDurationMinutes: 90,
      toolCalls: { Read: 9, Edit: 6, Bash: 3 },
    },
  ]

  const overview: OverviewStats = {
    totalSessions: 3,
    totalProjects: 1,
    totalMessages: 30,
    totalUserMessages: 15,
    totalAssistantMessages: 15,
    totalInputTokens: 15000,
    totalOutputTokens: 6000,
    totalCacheCreationTokens: 3000,
    totalCacheReadTokens: 1500,
    totalTokens: 25500,
    totalCostUSD: 0.85,
    totalDurationMinutes: 90,
    totalToolCalls: 18,
    totalApiErrors: 0,
    totalRateLimitDays: 0,
    totalUserInterruptions: 0,
    totalSystemPromptEdits: 0,
    models: { 'claude-sonnet-4-20250514': 3 },
    skillUsage: {},
    permissionModes: {},
  }

  const toolUsage = { Read: 9, Edit: 6, Bash: 3 }

  return { overview, sessions, projects, daily, toolUsage, ...overrides }
}
