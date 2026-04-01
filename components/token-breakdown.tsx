'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Label,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { DailyUsage, OverviewStats } from '@/lib/parse-logs'
import { formatTokens } from '@/lib/format'
import { useMemo } from 'react'

const pieConfig = {
  input: { label: 'Input', color: 'var(--chart-1)' },
  output: { label: 'Output', color: 'var(--chart-7)' },
  cacheWrite: { label: 'Cache Write', color: 'var(--chart-4)' },
  cacheRead: { label: 'Cache Read', color: 'var(--chart-8)' },
} satisfies ChartConfig

const areaConfig = {
  input: { label: 'Input', color: 'var(--chart-1)' },
  output: { label: 'Output', color: 'var(--chart-7)' },
  cacheWrite: { label: 'Cache Write', color: 'var(--chart-4)' },
  cacheRead: { label: 'Cache Read', color: 'var(--chart-8)' },
} satisfies ChartConfig

export function TokenBreakdown({
  daily,
  overview,
}: {
  daily: DailyUsage[]
  overview: OverviewStats
}) {
  const pieData = useMemo(() => [
    { name: 'input', value: overview.totalInputTokens, fill: 'var(--color-input)' },
    { name: 'output', value: overview.totalOutputTokens, fill: 'var(--color-output)' },
    { name: 'cacheWrite', value: overview.totalCacheCreationTokens, fill: 'var(--color-cacheWrite)' },
    { name: 'cacheRead', value: overview.totalCacheReadTokens, fill: 'var(--color-cacheRead)' },
  ].filter((d) => d.value > 0), [overview])

  const totalTokens = useMemo(
    () => pieData.reduce((sum, d) => sum + d.value, 0),
    [pieData]
  )

  const areaData = daily.map((d) => ({
    date: d.date.slice(5),
    input: d.inputTokens,
    output: d.outputTokens,
    cacheWrite: d.cacheCreationTokens,
    cacheRead: d.cacheReadTokens,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Token Distribution</CardTitle>
          <CardDescription>Breakdown by token type</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={pieConfig} className="mx-auto aspect-square max-h-[350px]">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="name"
                    formatter={(value) => formatTokens(Number(value))}
                  />
                }
              />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                strokeWidth={2}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {formatTokens(totalTokens)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                            Total
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Daily Token Usage</CardTitle>
          <CardDescription>Stacked token breakdown over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={areaConfig} className="min-h-[300px] w-full">
            <AreaChart data={areaData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatTokens(v)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value) => formatTokens(Number(value))}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="cacheRead"
                stackId="1"
                fill="var(--color-cacheRead)"
                stroke="var(--color-cacheRead)"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="cacheWrite"
                stackId="1"
                fill="var(--color-cacheWrite)"
                stroke="var(--color-cacheWrite)"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="output"
                stackId="1"
                fill="var(--color-output)"
                stroke="var(--color-output)"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="input"
                stackId="1"
                fill="var(--color-input)"
                stroke="var(--color-input)"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
