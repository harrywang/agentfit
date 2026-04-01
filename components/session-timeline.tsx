'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { SessionSummary } from '@/lib/parse-logs'
import { formatCost, formatDuration, formatNumber } from '@/lib/format'

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-6': 'oklch(0.65 0.12 250)',
  'claude-sonnet-4-6': 'oklch(0.70 0.12 200)',
  'claude-haiku-4-5': 'oklch(0.75 0.10 155)',
  'default': 'oklch(0.70 0.08 200)',
}

function getModelColor(model: string): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (key !== 'default' && model.includes(key.replace('claude-', ''))) return color
  }
  return MODEL_COLORS.default
}

interface DayRow {
  date: string
  sessions: SessionSummary[]
  earliest: number // ms timestamp
  latest: number
}

export function SessionTimeline({ sessions }: { sessions: SessionSummary[] }) {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)

  const { days, dayStart, dayEnd } = useMemo(() => {
    const dayMap = new Map<string, SessionSummary[]>()
    for (const s of sessions) {
      if (!s.startTime) continue
      const date = s.startTime.slice(0, 10)
      if (!dayMap.has(date)) dayMap.set(date, [])
      dayMap.get(date)!.push(s)
    }

    const rows: DayRow[] = []
    for (const [date, daySessions] of dayMap) {
      const times = daySessions.flatMap(s => {
        const start = new Date(s.startTime).getTime()
        const end = s.endTime ? new Date(s.endTime).getTime() : start + s.durationMinutes * 60000
        return [start, end]
      })
      rows.push({
        date,
        sessions: daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime)),
        earliest: Math.min(...times),
        latest: Math.max(...times),
      })
    }

    rows.sort((a, b) => b.date.localeCompare(a.date))

    // Use 0:00 - 24:00 as the timeline range
    return {
      days: rows.slice(0, 30), // last 30 days
      dayStart: 0,
      dayEnd: 24 * 60, // in minutes
    }
  }, [sessions])

  if (days.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Timeline</CardTitle>
          <CardDescription>No sessions with timestamp data</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const totalMinutes = dayEnd - dayStart
  const hourMarkers = Array.from({ length: 25 }, (_, i) => i)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Timeline</CardTitle>
        <CardDescription>
          Daily session activity — each bar is a session, width = duration, color = model.
          Showing last {days.length} active days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Hour labels */}
          <div className="flex items-end mb-1" style={{ paddingLeft: 90 }}>
            <div className="relative w-full" style={{ height: 16 }}>
              {hourMarkers.filter(h => h % 3 === 0).map(h => (
                <span
                  key={h}
                  className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                  style={{ left: `${(h * 60 / totalMinutes) * 100}%` }}
                >
                  {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                </span>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-0.5">
            {days.map(day => (
              <div key={day.date} className="flex items-center gap-2" style={{ height: 28 }}>
                {/* Date label */}
                <div className="w-[80px] shrink-0 text-right text-xs text-muted-foreground font-mono">
                  {day.date.slice(5)}
                </div>

                {/* Timeline bar */}
                <div className="relative flex-1 h-full rounded-sm bg-muted/30">
                  {/* Hour gridlines */}
                  {hourMarkers.filter(h => h % 6 === 0).map(h => (
                    <div
                      key={h}
                      className="absolute top-0 h-full w-px bg-border/50"
                      style={{ left: `${(h * 60 / totalMinutes) * 100}%` }}
                    />
                  ))}

                  {/* Session blocks */}
                  {day.sessions.map(s => {
                    const startDate = new Date(s.startTime)
                    const startMin = startDate.getHours() * 60 + startDate.getMinutes()
                    const duration = Math.max(s.durationMinutes, 3) // min 3min width for visibility
                    const leftPct = (startMin / totalMinutes) * 100
                    const widthPct = Math.min((duration / totalMinutes) * 100, 100 - leftPct)
                    const isHovered = hoveredSession === s.sessionId

                    return (
                      <Tooltip key={s.sessionId}>
                        <TooltipTrigger
                          render={
                            <div
                              className="absolute top-0.5 bottom-0.5 rounded-sm cursor-default transition-opacity"
                              style={{
                                left: `${leftPct}%`,
                                width: `${Math.max(widthPct, 0.3)}%`,
                                backgroundColor: getModelColor(s.model),
                                opacity: isHovered ? 1 : 0.75,
                                zIndex: isHovered ? 10 : 1,
                              }}
                              onMouseEnter={() => setHoveredSession(s.sessionId)}
                              onMouseLeave={() => setHoveredSession(null)}
                            />
                          }
                        />
                        <TooltipContent side="top" className="text-xs">
                          <div className="space-y-1">
                            <div className="font-semibold">{s.project}</div>
                            <div>{s.model}</div>
                            <div>{formatDuration(s.durationMinutes)} | {formatNumber(s.totalMessages)} msgs | {formatCost(s.costUSD)}</div>
                            <div>{new Date(s.startTime).toLocaleTimeString()} – {s.endTime ? new Date(s.endTime).toLocaleTimeString() : '?'}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            {Object.entries(MODEL_COLORS).filter(([k]) => k !== 'default').map(([model, color]) => (
              <span key={model} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                {model.replace('claude-', '')}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
