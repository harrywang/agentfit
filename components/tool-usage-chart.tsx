'use client'

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatNumber } from '@/lib/format'

const chartConfig = {
  count: { label: 'Calls', color: 'var(--chart-6)' },
} satisfies ChartConfig

export function ToolUsageChart({ toolUsage }: { toolUsage: Record<string, number> }) {
  const data = Object.entries(toolUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({
      name: name.length > 25 ? name.slice(0, 22) + '...' : name,
      fullName: name,
      count,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Usage</CardTitle>
        <CardDescription>Top 20 tools by invocation count</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ minHeight: Math.max(400, data.length * 32) }}
        >
          <BarChart data={data} layout="vertical" margin={{ left: 8 }} accessibilityLayer>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={120}
              tickFormatter={(v) => v}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatNumber(Number(value))}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullName || ''}
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
