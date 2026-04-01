'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UsageData } from '@/lib/parse-logs'
import { generateCoachInsights, type CraftScores } from '@/lib/coach'
import { ArrowRight, AlertTriangle, Lightbulb, Flame } from 'lucide-react'

function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const radius = (size - 14) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const getColor = (s: number) => {
    if (s >= 85) return 'var(--chart-2)'
    if (s >= 70) return 'var(--chart-1)'
    if (s >= 55) return 'var(--chart-3)'
    return 'var(--chart-5)'
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--muted)" strokeWidth="7"
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={getColor(score)} strokeWidth="7"
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-bold" style={{ fontSize: size * 0.24 }}>
        {score}
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: size * 0.1 }}>
        / 100
      </text>
    </svg>
  )
}

const CRAFT_LABELS: { key: keyof CraftScores; letter: string; label: string; color: string }[] = [
  { key: 'context', letter: 'C', label: 'Context', color: 'var(--chart-1)' },
  { key: 'reach', letter: 'R', label: 'Reach', color: 'var(--chart-2)' },
  { key: 'autonomy', letter: 'A', label: 'Autonomy', color: 'var(--chart-3)' },
  { key: 'flow', letter: 'F', label: 'Flow', color: 'var(--chart-4)' },
  { key: 'throughput', letter: 'T', label: 'Throughput', color: 'var(--chart-6)' },
]

function CraftBars({ craft }: { craft: CraftScores }) {
  return (
    <div className="space-y-1.5">
      {CRAFT_LABELS.map(({ key, letter, label, color }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-4 text-[10px] font-bold" style={{ color }}>{letter}</span>
          <span className="w-16 text-[10px] text-muted-foreground truncate">{label}</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${craft[key]}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-6 text-[10px] font-medium text-right">{craft[key]}</span>
        </div>
      ))}
    </div>
  )
}

export function FitnessScore({ data }: { data: UsageData }) {
  const coach = useMemo(() => generateCoachInsights(data), [data])

  // Pick top 2 insights: warnings first, then tips
  const topInsights = [
    ...coach.insights.filter(i => i.severity === 'warning'),
    ...coach.insights.filter(i => i.severity === 'tip'),
  ].slice(0, 2)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* CRAFT Status — score ring + dimension bars in one card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">CRAFT Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={coach.score} />
            <div className="text-xs font-semibold">{coach.scoreLabel}</div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Flame className="h-3 w-3" />
              {coach.stats.currentStreak > 0
                ? `${coach.stats.currentStreak}d streak (best: ${coach.stats.longestStreak}d)`
                : 'Start a streak'}
            </div>
            <Link
              href="/coach"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline mt-1"
            >
              All insights <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1">
            <CraftBars craft={coach.craft} />
          </div>
        </CardContent>
      </Card>

      {/* Top 2 Insights */}
      {topInsights.map((insight, i) => (
        <Card
          key={insight.id}
          className={`border-l-4 ${insight.severity === 'warning' ? 'border-l-chart-5' : 'border-l-chart-1'}`}
        >
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
              {insight.severity === 'warning'
                ? <><AlertTriangle className="h-3 w-3 text-chart-5" /> {i === 0 ? 'Top Priority' : 'Improve'}</>
                : <><Lightbulb className="h-3 w-3 text-chart-1" /> Tip</>}
              {insight.craft && (
                <span className="ml-auto text-[9px] uppercase tracking-wider opacity-60">{insight.craft}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold mb-1 line-clamp-1">{insight.title}</div>
            <p className="text-xs text-muted-foreground line-clamp-2">{insight.recommendation || insight.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
