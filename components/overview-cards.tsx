'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { OverviewStats, SessionSummary } from '@/lib/parse-logs'
import { formatCost, formatTokens, formatDuration, formatNumber } from '@/lib/format'
import {
  DollarSign,
  Coins,
  LayoutList,
  FolderOpen,
  MessageSquare,
  Wrench,
  Clock,
  Cpu,
  Sun,
  CalendarClock,
  AlertTriangle,
  Ban,
  Flame,
  Zap,
  Calendar,
  HelpCircle,
} from 'lucide-react'

function computeTopHours(sessions: SessionSummary[]): string {
  if (sessions.length === 0) return 'N/A'
  const hourCounts = new Array(24).fill(0)
  for (const s of sessions) {
    const timestamps = s.messageTimestamps
    if (timestamps && timestamps.length > 0) {
      for (const ts of timestamps) {
        hourCounts[new Date(ts).getHours()]++
      }
    } else if (s.startTime) {
      hourCounts[new Date(s.startTime).getHours()]++
    }
  }
  const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
  const top2 = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
  return top2.map((t) => fmt(t.hour)).join(', ')
}

const IDLE_THRESHOLD_MS = 30 * 60 * 1000 // 30 min — gaps longer than this are idle time

function computeAvgDailyTime(sessions: SessionSummary[]): number {
  if (sessions.length === 0) return 0
  // Collect all message timestamps grouped by local date.
  // Sum only gaps between consecutive messages that are under the idle threshold.
  const dayTimestamps = new Map<string, number[]>()

  for (const s of sessions) {
    const timestamps = s.messageTimestamps
    if (!timestamps || timestamps.length === 0) continue
    for (const ts of timestamps) {
      const d = new Date(ts)
      const ms = d.getTime()
      const date = d.toLocaleDateString('en-CA')
      if (!dayTimestamps.has(date)) dayTimestamps.set(date, [])
      dayTimestamps.get(date)!.push(ms)
    }
  }

  let totalMinutes = 0
  for (const timestamps of dayTimestamps.values()) {
    timestamps.sort((a, b) => a - b)
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1]
      if (gap <= IDLE_THRESHOLD_MS) {
        totalMinutes += gap / 60000
      }
    }
  }

  return dayTimestamps.size > 0 ? totalMinutes / dayTimestamps.size : 0
}

function computeAvgParallelSessions(sessions: SessionSummary[]): string {
  if (sessions.length === 0) return '0'
  // Group sessions by local date, count how many are active per day
  const daySessions = new Map<string, number>()
  for (const s of sessions) {
    if (!s.startTime) continue
    const date = new Date(s.startTime).toLocaleDateString('en-CA')
    daySessions.set(date, (daySessions.get(date) || 0) + 1)
  }
  if (daySessions.size === 0) return '0'
  const total = Array.from(daySessions.values()).reduce((a, b) => a + b, 0)
  const avg = total / daySessions.size
  return avg.toFixed(1)
}

function computeStreaks(sessions: SessionSummary[]): { longest: number; current: number; activeDays: number } {
  if (sessions.length === 0) return { longest: 0, current: 0, activeDays: 0 }

  const activeDates = new Set<string>()
  for (const s of sessions) {
    if (s.startTime) {
      activeDates.add(new Date(s.startTime).toLocaleDateString('en-CA'))
    }
  }

  if (activeDates.size === 0) return { longest: 0, current: 0, activeDays: 0 }

  const sorted = Array.from(activeDates).sort()
  let longest = 1
  let streak = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays === 1) {
      streak++
      if (streak > longest) longest = streak
    } else {
      streak = 1
    }
  }

  // Current streak: count backwards from today
  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')
  let current = 0
  if (activeDates.has(today) || activeDates.has(yesterday)) {
    const start = activeDates.has(today) ? today : yesterday
    current = 1
    let d = new Date(start)
    while (true) {
      d = new Date(d.getTime() - 86400000)
      if (activeDates.has(d.toLocaleDateString('en-CA'))) {
        current++
      } else {
        break
      }
    }
  }

  return { longest, current, activeDays: activeDates.size }
}

interface MetricDef {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  explanation: string
}

export function OverviewCards({ overview, sessions }: { overview: OverviewStats; sessions: SessionSummary[] }) {
  const topHours = useMemo(() => computeTopHours(sessions), [sessions])
  const avgDailyTime = useMemo(() => computeAvgDailyTime(sessions), [sessions])
  const streaks = useMemo(() => computeStreaks(sessions), [sessions])

  const cards: MetricDef[] = [
    {
      title: 'Total Cost',
      value: formatCost(overview.totalCostUSD),
      icon: DollarSign,
      explanation: 'Estimated total USD cost across all sessions. Calculated by multiplying each session\'s token counts (input, output, cache write, cache read) by the model\'s per-token pricing from LiteLLM. Does not include subscription fees — only API token costs.',
    },
    {
      title: 'Total Tokens',
      value: formatTokens(overview.totalTokens),
      icon: Coins,
      explanation: 'Sum of all tokens across every session: input tokens + output tokens + cache creation tokens + cache read tokens. This is the raw volume of data processed by the model.',
    },
    {
      title: 'Sessions',
      value: formatNumber(overview.totalSessions),
      icon: LayoutList,
      explanation: 'Number of distinct conversation sessions (each JSONL file = one session). A session starts when you launch Claude Code and ends when you close it or it times out.',
    },
    {
      title: 'Projects',
      value: formatNumber(overview.totalProjects),
      icon: FolderOpen,
      explanation: 'Number of unique project directories you\'ve used Claude Code in. Derived from the folder name in ~/.claude/projects/.',
    },
    {
      title: 'Messages',
      value: formatNumber(overview.totalMessages),
      icon: MessageSquare,
      explanation: 'Total number of user + assistant messages across all sessions. Each back-and-forth exchange counts as two messages (one user, one assistant).',
    },
    {
      title: 'Tool Calls',
      value: formatNumber(overview.totalToolCalls),
      icon: Wrench,
      explanation: 'Total number of tool invocations by the assistant (Read, Edit, Bash, Grep, Write, Agent, etc.). Each tool_use content block in an assistant message counts as one call.',
    },
    {
      title: 'Est. Daily Time',
      value: formatDuration(avgDailyTime),
      icon: CalendarClock,
      explanation: 'Average active coding time per day. Computed from individual message timestamps: sums gaps between consecutive messages that are under 30 minutes (idle gaps are excluded). Then divides by the number of active days.',
    },
    {
      title: 'Top Hours',
      value: topHours,
      icon: Sun,
      explanation: 'The two hours of day with the most message activity. Based on individual message timestamps across all sessions, grouped by hour in your local timezone. Note: logs only store UTC timestamps, so this conversion uses your browser\'s current timezone — it is only accurate if you mostly code from one timezone.',
    },
    {
      title: 'Avg Parallel',
      value: computeAvgParallelSessions(sessions),
      icon: Clock,
      explanation: 'Average number of sessions active in parallel per day. For each active day, counts how many sessions have overlapping time ranges, then averages across all days.',
    },
    {
      title: 'Top Model',
      value: Object.entries(overview.models).filter(([k]) => k !== 'unknown').sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
      icon: Cpu,
      explanation: 'The Claude model used in the most sessions. Determined by the model field in assistant responses. If a session uses multiple models, the last one seen is recorded.',
    },
    {
      title: 'Longest Streak',
      value: `${streaks.longest}d`,
      icon: Flame,
      explanation: 'The longest consecutive-day coding streak. A day counts as active if at least one session was started that day. Helps you see your most sustained periods of AI-assisted coding.',
    },
    {
      title: 'Current Streak',
      value: `${streaks.current}d`,
      icon: Zap,
      explanation: 'Your current consecutive-day coding streak, counting back from today (or yesterday if you haven\'t coded today yet). Keep it going!',
    },
    {
      title: 'Active Days',
      value: formatNumber(streaks.activeDays),
      icon: Calendar,
      explanation: 'Total number of unique days with at least one coding session. Shows how consistently you\'ve been using AI coding tools over time.',
    },
    {
      title: 'Rate Limit Days',
      value: formatNumber(overview.totalRateLimitDays),
      icon: AlertTriangle,
      explanation: 'Number of unique days where you hit API rate limits. Rate limits (HTTP 429/529, "Rate limit reached/exceeded") indicate heavy token usage that day. This is a better signal of usage intensity than raw API error counts, which include unrelated server errors.',
    },
    {
      title: 'Interruptions',
      value: formatNumber(overview.totalUserInterruptions),
      icon: Ban,
      explanation: 'Number of times you interrupted or rejected a tool execution. Detected from tool_result messages containing "The user doesn\'t want to proceed". High counts may indicate the agent is taking unwanted actions.',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <MetricCard key={card.title} metric={card} />
      ))}
    </div>
  )
}

function MetricCard({ metric }: { metric: MetricDef }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="group relative">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          {metric.title}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={<button />}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <metric.icon className="h-5 w-5" />
                  {metric.title}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed pt-2">
                  {metric.explanation}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-3xl font-bold">{metric.value}</div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <metric.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{metric.value}</div>
      </CardContent>
    </Card>
  )
}
