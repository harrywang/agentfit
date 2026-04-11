'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { SessionSummary, DailyUsage } from '@/lib/parse-logs'

// ─── 1. Model Distribution (horizontal bar) ────────────────────────

const barConfig = {
  messages: { label: 'Messages', color: 'var(--chart-1)' },
} satisfies ChartConfig

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

function shortenModelName(name: string): string {
  return name
    .replace('claude-', '')
    .replace('anthropic/', '')
    .replace(/-\d{8}$/, '')
}

export function ModelDistributionChart({ sessions }: { sessions: SessionSummary[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sessions) {
      for (const [m, count] of Object.entries(s.modelCounts || {})) {
        if (m !== 'unknown') {
          counts[m] = (counts[m] || 0) + count
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, messages], i) => ({
        name: shortenModelName(name),
        fullName: name,
        messages,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
  }, [sessions])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Distribution</CardTitle>
          <CardDescription>Messages per model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            No model data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = data.reduce((a, d) => a + d.messages, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Distribution</CardTitle>
        <CardDescription>{total.toLocaleString()} total assistant messages across {data.length} model{data.length !== 1 ? 's' : ''}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={barConfig} className="w-full" style={{ minHeight: Math.max(200, data.length * 40) }}>
          <BarChart data={data} layout="vertical" margin={{ left: 8 }} accessibilityLayer>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={160} />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const pct = ((d.messages / total) * 100).toFixed(1)
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
                    <div className="font-semibold">{d.fullName}</div>
                    <div className="mt-1 text-muted-foreground">
                      <span className="font-mono font-medium text-foreground">{d.messages.toLocaleString()}</span> messages ({pct}%)
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="messages" radius={[0, 4, 4, 0]}>
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

// ─── 2. Model Usage Over Time (stacked area) ───────────────────────

export function ModelUsageOverTimeChart({ sessions }: { sessions: SessionSummary[] }) {
  const { data, topModels, config } = useMemo(() => {
    // Find top models by total message count
    const totalCounts: Record<string, number> = {}
    for (const s of sessions) {
      for (const [m, count] of Object.entries(s.modelCounts || {})) {
        if (m !== 'unknown') {
          totalCounts[m] = (totalCounts[m] || 0) + count
        }
      }
    }
    const sorted = Object.entries(totalCounts).sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 6).map(([name]) => name)

    // Group by date
    const byDate = new Map<string, Record<string, number>>()
    for (const s of sessions) {
      const date = s.startTime.slice(0, 10)
      if (!byDate.has(date)) byDate.set(date, {})
      const day = byDate.get(date)!
      for (const [m, count] of Object.entries(s.modelCounts || {})) {
        if (m !== 'unknown') {
          day[m] = (day[m] || 0) + count
        }
      }
    }

    const sortedDates = Array.from(byDate.keys()).sort()
    const points = sortedDates.map((date) => {
      const day = byDate.get(date)!
      const row: Record<string, string | number> = { date: date.slice(5) }
      for (const m of top) {
        row[shortenModelName(m)] = day[m] || 0
      }
      return row
    })

    const cfg: ChartConfig = {}
    for (let i = 0; i < top.length; i++) {
      const short = shortenModelName(top[i])
      cfg[short] = { label: short, color: CHART_COLORS[i % CHART_COLORS.length] }
    }

    return { data: points, topModels: top.map(shortenModelName), config: cfg }
  }, [sessions])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Usage Over Time</CardTitle>
          <CardDescription>Daily messages by model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[250px] items-center justify-center text-sm text-muted-foreground">
            No model data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Usage Over Time</CardTitle>
        <CardDescription>Daily assistant messages by model</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="min-h-[250px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {topModels.map((m) => (
              <Area
                key={m}
                dataKey={m}
                type="monotone"
                stackId="1"
                stroke={config[m]?.color}
                fill={config[m]?.color}
                fillOpacity={0.4}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
