'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Bar,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import type { SessionSummary } from '@/lib/parse-logs'

const chartConfig = {
  releases: { label: 'New Releases', color: 'var(--chart-2)' },
  behind: { label: 'Versions Behind', color: 'var(--chart-5)' },
} satisfies ChartConfig

function semverToNum(v: string): number {
  const parts = v.split('.').map(Number)
  return (parts[0] || 0) * 1_000_000 + (parts[1] || 0) * 1_000 + (parts[2] || 0)
}

// Only match stable semver (no prerelease/beta suffixes)
function isStableVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v)
}

export function VersionLagChart({ sessions }: { sessions: SessionSummary[] }) {
  const [npmVersions, setNpmVersions] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/cc-versions')
      .then((r) => r.json())
      .then((data) => setNpmVersions(data))
      .catch(() => {})
  }, [])

  const { data, currentLag, currentUserVersion, currentLatestVersion, totalReleases } = useMemo(() => {
    const empty = { data: [], currentLag: 0, currentUserVersion: '', currentLatestVersion: '', totalReleases: 0 }
    if (!Object.keys(npmVersions).length || !sessions.length) return empty

    // Filter to stable versions only
    const stableVersions = Object.entries(npmVersions)
      .filter(([v]) => isStableVersion(v))
      .map(([version, date]) => ({
        version,
        date: date.slice(0, 10),
        num: semverToNum(version),
      }))
      .sort((a, b) => a.num - b.num)

    // Determine session date range first
    const sessionDates = sessions
      .filter(s => s.cliVersion && s.cliVersion !== 'unknown')
      .map(s => s.startTime.slice(0, 10))
      .sort()
    const rangeStart = sessionDates[0] || ''
    const rangeEnd = sessionDates[sessionDates.length - 1] || ''

    // Count releases and build per-day map within the session date range
    let total = 0
    const releasesPerDay = new Map<string, number>()
    for (const v of stableVersions) {
      if (v.date >= rangeStart && v.date <= rangeEnd) {
        total++
        releasesPerDay.set(v.date, (releasesPerDay.get(v.date) || 0) + 1)
      }
    }

    // Count how many stable versions are newer than userVersion as of date
    function countBehind(userVersion: string, date: string): number {
      const userNum = semverToNum(userVersion)
      let count = 0
      for (const v of stableVersions) {
        if (v.date <= date && v.num > userNum) count++
      }
      return count
    }

    function latestAtDate(date: string): string {
      let best = ''
      let bestNum = 0
      for (const v of stableVersions) {
        if (v.date <= date && v.num > bestNum) {
          best = v.version
          bestNum = v.num
        }
      }
      return best
    }

    // Group sessions by date
    const byDate = new Map<string, string[]>()
    for (const s of sessions) {
      if (!s.cliVersion || s.cliVersion === 'unknown') continue
      const date = s.startTime.slice(0, 10)
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date)!.push(s.cliVersion)
    }

    if (byDate.size === 0) return empty

    // Build date range: from first session date to last
    const sortedDates = Array.from(byDate.keys()).sort()
    const startDate = new Date(sortedDates[0])
    const endDate = new Date(sortedDates[sortedDates.length - 1])

    // Fill every day in the range
    const points: {
      date: string
      releases: number
      behind: number
      userVersion: string
      latestVersion: string
    }[] = []

    let lastUserVersion = ''
    const d = new Date(startDate)
    while (d <= endDate) {
      const dateStr = d.toLocaleDateString('en-CA') // YYYY-MM-DD
      const dayVersions = byDate.get(dateStr)

      if (dayVersions) {
        // Pick most common version that day
        const counts = new Map<string, number>()
        for (const v of dayVersions) {
          counts.set(v, (counts.get(v) || 0) + 1)
        }
        lastUserVersion = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      }

      if (lastUserVersion) {
        const latest = latestAtDate(dateStr)
        const behind = countBehind(lastUserVersion, dateStr)

        points.push({
          date: dateStr.slice(5),
          releases: releasesPerDay.get(dateStr) || 0,
          behind,
          userVersion: lastUserVersion,
          latestVersion: latest,
        })
      }

      d.setDate(d.getDate() + 1)
    }

    const last = points[points.length - 1]
    return {
      data: points,
      currentLag: last?.behind ?? 0,
      currentUserVersion: last?.userVersion ?? '',
      currentLatestVersion: last?.latestVersion ?? '',
      totalReleases: total,
    }
  }, [sessions, npmVersions])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version Freshness</CardTitle>
          <CardDescription>Your Claude Code version vs latest release over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[250px] items-center justify-center text-sm text-muted-foreground">
            No version data available. Re-sync to capture CLI versions.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version Freshness</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {currentLag === 0 ? (
            <span className="text-green-600 dark:text-green-400">
              Up to date (v{currentUserVersion})
            </span>
          ) : (
            <span>
              v{currentUserVersion} —{' '}
              <strong className="text-amber-600 dark:text-amber-400">
                {currentLag} release{currentLag !== 1 ? 's' : ''} behind
              </strong>{' '}
              (latest: v{currentLatestVersion})
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {totalReleases} stable releases
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
          <ComposedChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
                    <div className="font-semibold">{d.date}</div>
                    <div className="mt-1 space-y-0.5 text-muted-foreground">
                      <div className="flex justify-between gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-2)' }} />
                          New releases
                        </span>
                        <span className="font-mono font-medium text-foreground">{d.releases}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Your version</span>
                        <span className="font-mono font-medium text-foreground">v{d.userVersion}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Latest</span>
                        <span className="font-mono font-medium text-foreground">v{d.latestVersion}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-t pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-5)' }} />
                          Behind
                        </span>
                        <span className={`font-mono font-semibold ${d.behind === 0 ? 'text-green-600' : d.behind <= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                          {d.behind === 0 ? 'up to date' : `${d.behind} release${d.behind !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="releases"
              fill="var(--color-releases)"
              fillOpacity={0.3}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="left"
              dataKey="behind"
              type="monotone"
              stroke="var(--color-behind)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-behind)' }}
            />
          </ComposedChart>
        </ChartContainer>
        {/* Legend */}
        <div className="mt-2 flex items-center justify-end gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm opacity-40" style={{ backgroundColor: 'var(--chart-2)' }} />
            Daily releases
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: 'var(--chart-5)' }} />
            Versions behind
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
