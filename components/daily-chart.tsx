'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import type { DailyUsage, SessionSummary } from '@/lib/parse-logs'
import { formatCost } from '@/lib/format'

// ─── 1. Daily Cost ──────────────────────────────────────────────────

const costConfig = {
  cost: { label: 'Cost', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function DailyCostChart({ daily }: { daily: DailyUsage[] }) {
  const data = daily.map((d) => ({
    date: d.date.slice(5),
    cost: Number(d.costUSD.toFixed(2)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Cost</CardTitle>
        <CardDescription>USD spent per day</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={costConfig} className="min-h-[250px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatCost(Number(value))} />}
            />
            <Line dataKey="cost" type="monotone" stroke="var(--color-cost)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-cost)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── 2. Tool Mix Over Time ──────────────────────────────────────────

const TOP_TOOLS = ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Agent'] as const
const toolMixConfig = {
  Read: { label: 'Read', color: 'var(--chart-1)' },
  Edit: { label: 'Edit', color: 'var(--chart-2)' },
  Write: { label: 'Write', color: 'var(--chart-3)' },
  Bash: { label: 'Bash', color: 'var(--chart-4)' },
  Grep: { label: 'Grep', color: 'var(--chart-6)' },
  Agent: { label: 'Agent', color: 'var(--chart-7)' },
} satisfies ChartConfig

export function ToolMixChart({ daily }: { daily: DailyUsage[] }) {
  const data = daily.map((d) => {
    const row: Record<string, string | number> = { date: d.date.slice(5) }
    for (const tool of TOP_TOOLS) {
      row[tool] = d.toolCallsDetail[tool] || 0
    }
    return row
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Mix Over Time</CardTitle>
        <CardDescription>Daily tool calls — explore (Read/Grep) vs build (Edit/Write)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={toolMixConfig} className="min-h-[250px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {TOP_TOOLS.map((tool) => (
              <Area
                key={tool}
                dataKey={tool}
                type="monotone"
                stackId="1"
                stroke={`var(--color-${tool})`}
                fill={`var(--color-${tool})`}
                fillOpacity={0.4}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── 3. Interruption Rate Trend ─────────────────────────────────────

const interruptionConfig = {
  rate: { label: 'Interruption Rate', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function InterruptionRateChart({ daily }: { daily: DailyUsage[] }) {
  const data = daily.map((d) => ({
    date: d.date.slice(5),
    rate: d.messages > 0 ? Number(((d.interruptions / d.messages) * 100).toFixed(1)) : 0,
    interruptions: d.interruptions,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interruption Rate</CardTitle>
        <CardDescription>Daily interruptions as % of messages — lower is better</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={interruptionConfig} className="min-h-[250px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) =>
                    name === 'rate' ? `${value}%` : String(value)
                  }
                />
              }
            />
            <Line dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-rate)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── 4. Top Skills Used ─────────────────────────────────────────────

const commandConfig = {
  count: { label: 'Uses', color: 'var(--chart-1)' },
} satisfies ChartConfig

interface CommandBarEntry {
  name: string
  count: number
  fill: string
  historyCount: number
  sessionCount: number
}

export function TopCommandsChart() {
  const [data, setData] = useState<CommandBarEntry[]>([])

  useEffect(() => {
    fetch('/api/commands')
      .then(r => r.json())
      .then(analysis => {
        const dbSkills: Record<string, number> = analysis.dbSkillCounts || {}
        const bi = analysis.commands
          .filter((c: { used: boolean; count: number }) => c.used && c.count > 0)
          .map((c: { command: string; count: number }) => {
            const sk = dbSkills[c.command] || 0
            return { name: c.command, count: c.count, fill: 'var(--chart-1)', historyCount: c.count - sk, sessionCount: sk }
          })
          .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
          .slice(0, 5)
        const cu = analysis.customCommands
          .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
          .slice(0, 5)
          .map((c: { command: string; count: number; historyCount?: number; sessionCount?: number }) => ({
            name: c.command,
            count: c.count,
            fill: 'var(--chart-4)',
            historyCount: c.historyCount || 0,
            sessionCount: c.sessionCount || 0,
          }))
        const combined = [...bi, ...cu].sort((a, b) => b.count - a.count)
        setData(combined)
      })
      .catch(() => {})
  }, [])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Commands & Skills</CardTitle>
          <CardDescription>Most used built-in commands and custom skills</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[250px] items-center justify-center text-sm text-muted-foreground">
            No commands used yet
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Commands & Skills</CardTitle>
        <CardDescription>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} /> Built-in</span>
          <span className="inline-flex items-center gap-1.5 ml-3"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-4)' }} /> Custom skill</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={commandConfig} className="w-full" style={{ minHeight: Math.max(200, data.length * 36) }}>
          <BarChart data={data} layout="vertical" margin={{ left: 8 }} accessibilityLayer>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={140} />
            <RechartsTooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as CommandBarEntry
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex justify-between gap-4">
                        <span>Slash command</span>
                        <span className="font-mono">{d.historyCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Skill invocation</span>
                        <span className="font-mono">{d.sessionCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-t pt-0.5 text-foreground font-medium">
                        <span>Total</span>
                        <span className="font-mono">{d.count ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── 5. User vs Assistant Messages ──────────────────────────────────

const msgRatioConfig = {
  userMessages: { label: 'User', color: 'var(--chart-1)' },
  assistantMessages: { label: 'Assistant', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function UserVsAssistantChart({ daily }: { daily: DailyUsage[] }) {
  const data = daily.map((d) => ({
    date: d.date.slice(5),
    userMessages: d.userMessages,
    assistantMessages: d.assistantMessages,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>User vs Assistant Messages</CardTitle>
        <CardDescription>Low user ratio = Claude doing more autonomous turns</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={msgRatioConfig} className="min-h-[250px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="userMessages" stackId="1" fill="var(--color-userMessages)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="assistantMessages" stackId="1" fill="var(--color-assistantMessages)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── 6. Token Usage Heatmap ─────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatTokensShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = MONTH_NAMES[d.getMonth()]
  const day = d.getDate()
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'
  return `${month} ${day}${suffix}`
}

export function TokenUsageHeatmap({ daily }: { daily: DailyUsage[] }) {
  const { tokensByDate, rateLimitByDate, maxTokens, totalTokens } = useMemo(() => {
    const tMap = new Map<string, number>()
    const rMap = new Map<string, number>()
    let max = 0
    let total = 0
    for (const d of daily) {
      tMap.set(d.date, d.totalTokens)
      total += d.totalTokens
      if (d.totalTokens > max) max = d.totalTokens
      if (d.rateLimitErrors > 0) rMap.set(d.date, d.rateLimitErrors)
    }
    return { tokensByDate: tMap, rateLimitByDate: rMap, maxTokens: max, totalTokens: total }
  }, [daily])

  const { weeks, monthLabels } = useMemo(() => {
    if (daily.length === 0) return { weeks: [], monthLabels: [] }
    const lastDate = new Date(daily[daily.length - 1].date)
    const result: { date: string; tokens: number; rateLimits: number; dayOfWeek: number }[][] = []
    const startDate = new Date(lastDate)
    startDate.setDate(startDate.getDate() - 83)
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay())

    let currentWeek: { date: string; tokens: number; rateLimits: number; dayOfWeek: number }[] = []
    const d = new Date(startDate)
    while (d <= lastDate) {
      const dateStr = d.toLocaleDateString('en-CA')
      currentWeek.push({
        date: dateStr,
        tokens: tokensByDate.get(dateStr) || 0,
        rateLimits: rateLimitByDate.get(dateStr) || 0,
        dayOfWeek: d.getDay(),
      })
      if (d.getDay() === 6) {
        result.push(currentWeek)
        currentWeek = []
      }
      d.setDate(d.getDate() + 1)
    }
    if (currentWeek.length > 0) result.push(currentWeek)

    // Compute month labels with column positions
    const labels: { label: string; col: number }[] = []
    let lastMonth = -1
    for (let wi = 0; wi < result.length; wi++) {
      const firstDay = result[wi][0]
      if (!firstDay) continue
      const month = new Date(firstDay.date).getMonth()
      if (month !== lastMonth) {
        labels.push({ label: MONTH_NAMES[month], col: wi })
        lastMonth = month
      }
    }

    return { weeks: result, monthLabels: labels }
  }, [daily, tokensByDate, rateLimitByDate])

  const totalRateLimitDays = rateLimitByDate.size

  function getIntensity(tokens: number): string {
    if (tokens === 0) return 'bg-muted'
    const ratio = tokens / maxTokens
    if (ratio <= 0.25) return 'bg-blue-200 dark:bg-blue-900/50'
    if (ratio <= 0.5) return 'bg-blue-300 dark:bg-blue-700/60'
    if (ratio <= 0.75) return 'bg-blue-400 dark:bg-blue-600/70'
    return 'bg-blue-500 dark:bg-blue-500'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {formatTokensShort(totalTokens)} tokens in the last {daily.length} days
        </CardTitle>
        <CardDescription>
          Daily token volume
          {totalRateLimitDays > 0 && (
            <span className="ml-1">
              · <span className="inline-block h-2.5 w-2.5 rounded-sm ring-2 ring-rose-400 ring-inset bg-blue-300 align-middle" /> = rate limited ({totalRateLimitDays}d)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
        <div className="overflow-x-auto">
          <div className="flex w-full gap-[3px]">
            {/* Day labels column — rendered as a matching grid so heights stay in sync */}
            <div className="grid shrink-0 grid-rows-[16px_repeat(7,1fr)] gap-[3px] pr-1 text-[10px] text-muted-foreground">
              <div />
              <div className="flex items-center">Sun</div>
              <div className="flex items-center">Mon</div>
              <div className="flex items-center">Tue</div>
              <div className="flex items-center">Wed</div>
              <div className="flex items-center">Thu</div>
              <div className="flex items-center">Fri</div>
              <div className="flex items-center">Sat</div>
            </div>
            {/* Week columns */}
            {weeks.map((week, wi) => {
              const monthLabel = monthLabels.find((m) => m.col === wi)
              return (
                <div key={wi} className="grid flex-1 grid-rows-[16px_repeat(7,1fr)] gap-[3px]">
                  <div className="text-[10px] text-muted-foreground leading-4 truncate">
                    {monthLabel?.label ?? ''}
                  </div>
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const cell = week.find((c) => c.dayOfWeek === dayIdx)
                    if (!cell) return <div key={dayIdx} className="aspect-square w-full" />
                    const hasRateLimit = cell.rateLimits > 0
                    const label = cell.tokens > 0
                      ? `${formatTokensShort(cell.tokens)} tokens on ${formatDateLabel(cell.date)}.${hasRateLimit ? ` Rate limited ${cell.rateLimits}×.` : ''}`
                      : `No tokens on ${formatDateLabel(cell.date)}.`
                    return (
                      <Tooltip key={dayIdx}>
                        <TooltipTrigger
                          render={<div />}
                          className={`aspect-square w-full rounded-sm ${getIntensity(cell.tokens)} ${hasRateLimit ? 'ring-2 ring-rose-400 ring-inset' : ''}`}
                        />
                        <TooltipContent>{label}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="h-[10px] w-[10px] rounded-sm bg-muted" />
            <div className="h-[10px] w-[10px] rounded-sm bg-blue-200 dark:bg-blue-900/50" />
            <div className="h-[10px] w-[10px] rounded-sm bg-blue-300 dark:bg-blue-700/60" />
            <div className="h-[10px] w-[10px] rounded-sm bg-blue-400 dark:bg-blue-600/70" />
            <div className="h-[10px] w-[10px] rounded-sm bg-blue-500 dark:bg-blue-500" />
            <span>More</span>
          </div>
        </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}

// ─── Export ──────────────────────────────────────────────────────────

export function DailyChart({ daily, sessions }: { daily: DailyUsage[]; sessions: SessionSummary[] }) {
  return (
    <>
      <DailyCostChart daily={daily} />
      <TopCommandsChart />
      <InterruptionRateChart daily={daily} />
      <UserVsAssistantChart daily={daily} />
    </>
  )
}
