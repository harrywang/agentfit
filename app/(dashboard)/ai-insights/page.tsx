'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts'
import { Sparkles, Loader2 } from 'lucide-react'
import { formatCost } from '@/lib/format'
import Link from 'next/link'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
]

interface AggregateData {
  totalMessages: number
  messageTypes: Record<string, number>
  roles: Record<string, number>
  skillLevels: Record<string, number>
  sentiments: Record<string, number>
  roleByType: Record<string, Record<string, number>>
  roleBySentiment: Record<string, Record<string, number>>
}

function DistributionChart({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: Record<string, number>
}) {
  const chartData = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  const config: ChartConfig = {
    count: { label: 'Count', color: 'var(--chart-1)' },
  }

  const total = chartData.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          className="w-full"
          style={{ minHeight: Math.max(150, chartData.length * 32) }}
        >
          <BarChart data={chartData} layout="vertical" margin={{ left: 8 }} accessibilityLayer>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={120}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => {
                    const n = Number(value)
                    return `${n} (${((n / total) * 100).toFixed(1)}%)`
                  }}
                />
              }
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function CrossTab({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: Record<string, Record<string, number>>
}) {
  const rows = Object.keys(data).sort()
  const colSet = new Set<string>()
  for (const row of rows) {
    for (const col of Object.keys(data[row])) colSet.add(col)
  }
  const cols = [...colSet].sort()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground" />
                {cols.map((col) => (
                  <th
                    key={col}
                    className="text-center py-1.5 px-2 font-medium text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{row}</td>
                  {cols.map((col) => (
                    <td key={col} className="text-center py-1.5 px-2 text-muted-foreground">
                      {data[row][col] || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AIInsightsPage() {
  const [aggregate, setAggregate] = useState<AggregateData | null>(null)
  const [analyzedCount, setAnalyzedCount] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analyze/aggregate')
        const data = await res.json()
        setAggregate(data.aggregate)
        setAnalyzedCount(data.analyzedCount || 0)
        setTotalCost(data.totalCostUSD || 0)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    )
  }

  if (!aggregate) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <Sparkles className="h-12 w-12 text-muted-foreground" />
          <div className="text-center space-y-1">
            <p className="text-lg font-medium">No AI analysis data yet</p>
            <p className="text-sm text-muted-foreground">
              Go to{' '}
              <Link href="/sessions" className="text-primary hover:underline">
                Sessions
              </Link>{' '}
              and analyze individual sessions, or use the &quot;Analyze All&quot; button.
            </p>
            <p className="text-sm text-muted-foreground">
              Make sure to add your OpenAI API key in{' '}
              <Link href="/settings" className="text-primary hover:underline">
                Settings
              </Link>{' '}
              first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {analyzedCount} sessions analyzed
          </Badge>
          <Badge variant="outline">
            {aggregate.totalMessages} messages classified
          </Badge>
          <Badge variant="outline">
            Total cost: {formatCost(totalCost)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DistributionChart
          title="Message Type Distribution"
          description="How you communicate with AI agents"
          data={aggregate.messageTypes}
        />
        <DistributionChart
          title="Role Distribution"
          description="Professional roles you play during sessions"
          data={aggregate.roles}
        />
        <DistributionChart
          title="Skill Level Distribution"
          description="Technical depth of your messages"
          data={aggregate.skillLevels}
        />
        <DistributionChart
          title="Sentiment Distribution"
          description="Emotional tone across all messages"
          data={aggregate.sentiments}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CrossTab
          title="Role x Message Type"
          description="What types of messages each role produces"
          data={aggregate.roleByType}
        />
        <CrossTab
          title="Role x Sentiment"
          description="Sentiment patterns by role"
          data={aggregate.roleBySentiment}
        />
      </div>
    </div>
  )
}
