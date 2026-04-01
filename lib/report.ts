// ─── Report Generation ───────────────────────────────────────────────
// Composes existing analyzers into a point-in-time snapshot report.

import { getUsageData } from './queries'
import { generateCoachInsights, type CoachInsight } from './coach'
import { analyzePersonality } from './personality'
import { generateCommandInsights, type CommandInsight } from './command-insights'
import { formatCost, formatDuration } from './format'

// ─── Report Content Schema ───────────────────────────────────────────

export interface ReportContent {
  atAGlance: {
    fitnessScore: number
    scoreLabel: string
    totalSessions: number
    totalProjects: number
    totalCostUSD: number
    totalDurationMinutes: number
    totalMessages: number
    totalToolCalls: number
    totalApiErrors: number
    totalUserInterruptions: number
    dateRange: { from: string; to: string }
    currentStreak: number
    longestStreak: number
  }
  projectAreas: {
    name: string
    sessions: number
    totalCost: number
    totalDurationMinutes: number
    totalMessages: number
    topTools: [string, number][]
  }[]
  interactionStyle: {
    avgMessagesPerSession: number
    avgDurationMinutes: number
    avgCostPerSession: number
    readEditRatio: number
    bashRatio: number
    agentCallsTotal: number
    peakHour: number
    mostActiveDay: string
    mbtiType: string
    mbtiDescription: string
  }
  whatWorks: CoachInsight[]
  frictionAnalysis: CoachInsight[]
  suggestions: {
    coachTips: CoachInsight[]
    commandTips: CommandInsight[]
    claudeMdRules: string[]
  }
}

// ─── Generation ──────────────────────────────────────────────────────

export async function generateReport(): Promise<{
  title: string
  contentJson: ReportContent
  sessionCount: number
}> {
  const data = await getUsageData()
  const coach = generateCoachInsights(data)
  const personality = analyzePersonality(data)
  const cmdInsights = generateCommandInsights()

  const { overview, sessions, projects, toolUsage } = data

  // Date range
  const sortedSessions = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const from = sortedSessions[0]?.startTime?.slice(0, 10) || 'N/A'
  const to = sortedSessions[sortedSessions.length - 1]?.startTime?.slice(0, 10) || 'N/A'

  // Tool ratios
  const readCalls = (toolUsage['Read'] || 0) + (toolUsage['Grep'] || 0) + (toolUsage['Glob'] || 0)
  const editCalls = (toolUsage['Edit'] || 0) + (toolUsage['Write'] || 0)
  const bashCalls = toolUsage['Bash'] || 0
  const agentCalls = toolUsage['Agent'] || 0
  const totalTools = overview.totalToolCalls

  // MBTI descriptions
  const mbtiDescriptions: Record<string, string> = {
    ISTJ: 'The Inspector — Methodical, detail-oriented, follows established procedures',
    ISFJ: 'The Protector — Supportive, reliable, focused on preserving working code',
    INFJ: 'The Counselor — Insightful, sees patterns, anticipates architectural needs',
    INTJ: 'The Architect — Strategic, independent, designs for long-term quality',
    ISTP: 'The Craftsman — Practical, efficient, excels at targeted fixes',
    ISFP: 'The Composer — Adaptable, aesthetic sense, good at UI refinement',
    INFP: 'The Healer — Idealistic, explores creative solutions, values code clarity',
    INTP: 'The Thinker — Analytical, explores edge cases, values logical consistency',
    ESTP: 'The Dynamo — Action-oriented, quick iterations, bias toward execution',
    ESFP: 'The Performer — Energetic, responsive, generates many alternatives',
    ENFP: 'The Champion — Enthusiastic explorer, broad tool usage, creative approaches',
    ENTP: 'The Visionary — Innovative, questions assumptions, proposes novel solutions',
    ESTJ: 'The Supervisor — Organized, efficient, follows project conventions strictly',
    ESFJ: 'The Provider — Cooperative, communicative, adapts to user preferences',
    ENFJ: 'The Teacher — Explains reasoning, mentors through code, proactive guidance',
    ENTJ: 'The Commander — Decisive, takes charge, designs comprehensive solutions',
  }

  const content: ReportContent = {
    atAGlance: {
      fitnessScore: coach.score,
      scoreLabel: coach.scoreLabel,
      totalSessions: overview.totalSessions,
      totalProjects: overview.totalProjects,
      totalCostUSD: overview.totalCostUSD,
      totalDurationMinutes: overview.totalDurationMinutes,
      totalMessages: overview.totalMessages,
      totalToolCalls: overview.totalToolCalls,
      totalApiErrors: overview.totalApiErrors,
      totalUserInterruptions: overview.totalUserInterruptions,
      dateRange: { from, to },
      currentStreak: coach.stats.currentStreak,
      longestStreak: coach.stats.longestStreak,
    },
    projectAreas: projects.slice(0, 10).map(p => ({
      name: p.name,
      sessions: p.sessions,
      totalCost: p.totalCost,
      totalDurationMinutes: p.totalDurationMinutes,
      totalMessages: p.totalMessages,
      topTools: Object.entries(p.toolCalls)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    })),
    interactionStyle: {
      avgMessagesPerSession: coach.stats.avgMessagesPerSession,
      avgDurationMinutes: coach.stats.avgDurationMinutes,
      avgCostPerSession: coach.stats.avgCostPerSession,
      readEditRatio: editCalls > 0 ? readCalls / editCalls : 0,
      bashRatio: totalTools > 0 ? bashCalls / totalTools : 0,
      agentCallsTotal: agentCalls,
      peakHour: coach.stats.peakHour,
      mostActiveDay: coach.stats.mostActiveDay,
      mbtiType: personality.mbtiType,
      mbtiDescription: mbtiDescriptions[personality.mbtiType] || 'Unique profile',
    },
    whatWorks: coach.insights.filter(i => i.severity === 'achievement'),
    frictionAnalysis: coach.insights.filter(i => i.severity === 'warning'),
    suggestions: {
      coachTips: coach.insights.filter(i => i.severity === 'tip'),
      commandTips: cmdInsights,
      claudeMdRules: coach.insights
        .filter(i => i.severity === 'warning' && i.recommendation)
        .map(i => i.recommendation!),
    },
  }

  const now = new Date()
  const title = `Report — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

  return { title, contentJson: content, sessionCount: overview.totalSessions }
}
