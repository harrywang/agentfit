'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCost } from '@/lib/format'
import type { PluginProps } from '@/lib/plugins'

// ─── Helpers ────────────────────────────────────────────────────────

function getWeekday(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay()
}

function getMonthLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleString('en-US', { month: 'short' })
}

function intensityStyle(ratio: number): React.CSSProperties {
  if (ratio === 0)
    return { backgroundColor: 'var(--muted)' }
  // Use chart-2 (teal) with increasing opacity for a clean gradient
  const alpha = 0.15 + ratio * 0.85
  return { backgroundColor: `oklch(0.55 0.15 170 / ${alpha})` }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Component ──────────────────────────────────────────────────────

export default function CostHeatmap({ data }: PluginProps) {
  const { grid, weeks, monthLabels, stats } = useMemo(() => {
    const dailyMap = new Map(data.daily.map((d) => [d.date, d.costUSD]))
    const dates = data.daily.map((d) => d.date).sort()

    if (dates.length === 0) {
      return { grid: [], maxCost: 0, weeks: 0, monthLabels: [], stats: null }
    }

    const first = dates[0]
    const last = dates[dates.length - 1]

    // Build a continuous date range
    const allDates: string[] = []
    const cur = new Date(first + 'T00:00:00')
    const end = new Date(last + 'T00:00:00')
    while (cur <= end) {
      allDates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }

    // Pad the start to align to Sunday
    const startPad = getWeekday(allDates[0])
    const padded = [
      ...Array.from({ length: startPad }, () => null),
      ...allDates,
    ]

    const maxVal = Math.max(...allDates.map((d) => dailyMap.get(d) || 0), 0.01)
    const numWeeks = Math.ceil(padded.length / 7)

    // Build grid: grid[weekday][weekIndex]
    const g: (({ date: string; cost: number; ratio: number } | null))[][] = Array.from(
      { length: 7 },
      () => Array.from({ length: numWeeks }, () => null),
    )

    for (let i = 0; i < padded.length; i++) {
      const week = Math.floor(i / 7)
      const day = i % 7
      const date = padded[i]
      if (date) {
        const cost = dailyMap.get(date) || 0
        g[day][week] = { date, cost, ratio: cost / maxVal }
      }
    }

    // Month labels at week boundaries
    const labels: { label: string; week: number }[] = []
    let lastMonth = ''
    for (let i = 0; i < padded.length; i++) {
      const date = padded[i]
      if (!date) continue
      const month = getMonthLabel(date)
      if (month !== lastMonth) {
        labels.push({ label: month, week: Math.floor(i / 7) })
        lastMonth = month
      }
    }

    // Stats
    const costs = allDates.map((d) => dailyMap.get(d) || 0)
    const total = costs.reduce((a, b) => a + b, 0)
    const activeDays = costs.filter((c) => c > 0).length
    const peakIdx = costs.indexOf(Math.max(...costs))
    const peakDay = allDates[peakIdx]

    return {
      grid: g,
      maxCost: maxVal,
      weeks: numWeeks,
      monthLabels: labels,
      stats: { total, activeDays, totalDays: allDates.length, peakDay, peakCost: maxVal },
    }
  }, [data.daily])

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available yet.</p>
        </CardContent>
      </Card>
    )
  }

  const cellSize = 18
  const cellGap = 3

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Spend</CardDescription>
            <CardTitle className="text-2xl">{formatCost(stats.total)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Days</CardDescription>
            <CardTitle className="text-2xl">
              {stats.activeDays} / {stats.totalDays}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Day</CardDescription>
            <CardTitle className="text-2xl">{stats.peakDay}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Cost</CardDescription>
            <CardTitle className="text-2xl">{formatCost(stats.peakCost)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Cost Heatmap</CardTitle>
          <CardDescription>
            Each cell represents one day. Darker cells = higher spending.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {/* Month labels */}
            <div className="flex items-end" style={{ paddingLeft: 40, marginBottom: 6 }}>
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="text-xs font-medium text-muted-foreground"
                  style={{
                    position: 'absolute',
                    left: 40 + m.week * (cellSize + cellGap),
                  }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="relative" style={{ paddingTop: 20 }}>
              <div className="flex" style={{ gap: cellGap }}>
                {/* Weekday labels */}
                <div className="flex flex-col" style={{ gap: cellGap, width: 36 }}>
                  {WEEKDAYS.map((d, i) => (
                    <span
                      key={d}
                      className="flex items-center text-xs text-muted-foreground"
                      style={{ height: cellSize }}
                    >
                      {i % 2 === 1 ? d : ''}
                    </span>
                  ))}
                </div>
                {/* Weeks */}
                {Array.from({ length: weeks }, (_, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col" style={{ gap: cellGap }}>
                    {Array.from({ length: 7 }, (_, dayIdx) => {
                      const cell = grid[dayIdx]?.[weekIdx]
                      if (!cell) {
                        return (
                          <div
                            key={dayIdx}
                            style={{ width: cellSize, height: cellSize }}
                            className="rounded-sm"
                          />
                        )
                      }
                      return (
                        <Tooltip key={dayIdx}>
                          <TooltipTrigger
                            render={
                              <div
                                className="rounded-sm transition-all hover:ring-2 hover:ring-foreground/30 hover:scale-110 cursor-default"
                                style={{ width: cellSize, height: cellSize, ...intensityStyle(cell.ratio) }}
                              />
                            }
                          />
                          <TooltipContent side="top" className="text-center">
                            <p className="text-xs font-medium">{cell.date}</p>
                            <p className="text-sm font-bold">{formatCost(cell.cost)}</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Less</span>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
                <div
                  key={ratio}
                  className="rounded-sm"
                  style={{ width: cellSize - 4, height: cellSize - 4, ...intensityStyle(ratio) }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
