'use client'

import { useMemo, useEffect, useState } from 'react'
import type { UsageData } from '@/lib/parse-logs'
import { generateCoachInsights, type CoachInsight, type InsightCategory, type InsightSeverity, type CraftDimension, type CraftScores } from '@/lib/coach'
import type { CommandInsight } from '@/lib/command-insights'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCost, formatDuration, formatNumber } from '@/lib/format'
import {
  Trophy,
  AlertTriangle,
  Lightbulb,
  DollarSign,
  Zap,
  Wrench,
  Monitor,
  Cpu,
  Flame,
  Calendar,
  Search,
  Clock,
  Brain,
  Radar,
  Bot,
  Activity,
  Gauge,
} from 'lucide-react'

const CATEGORY_ICONS: Record<InsightCategory, typeof Trophy> = {
  cost: DollarSign,
  efficiency: Zap,
  tools: Wrench,
  context: Monitor,
  model: Cpu,
  habits: Calendar,
  discovery: Search,
  streak: Flame,
}

const SEVERITY_STYLES: Record<InsightSeverity, { border: string; icon: typeof Trophy; iconClass: string }> = {
  achievement: { border: 'border-l-chart-2', icon: Trophy, iconClass: 'text-chart-2' },
  warning: { border: 'border-l-chart-5', icon: AlertTriangle, iconClass: 'text-chart-5' },
  tip: { border: 'border-l-chart-1', icon: Lightbulb, iconClass: 'text-chart-1' },
}

const CRAFT_DIMENSIONS: {
  key: CraftDimension
  letter: string
  label: string
  color: string
  icon: typeof Brain
  description: string
  metrics: string[]
}[] = [
  {
    key: 'context',
    letter: 'C',
    label: 'Context',
    color: 'var(--chart-1)',
    icon: Brain,
    description: 'How well you engineer the context available to the AI — not just window size, but the holistic curation of tokens: system prompts (CLAUDE.md), just-in-time retrieval, structured notes, sub-agent isolation, and cache efficiency.',
    metrics: ['System prompt maintenance (15%)', 'Cache reuse (15%)', 'Overflow avoidance (15%)', 'Just-in-time retrieval (20%)', 'Session length (10%)', 'Note-taking (10%)', 'Output density (10%)', 'Sub-agent isolation (5%)'],
  },
  {
    key: 'reach',
    letter: 'R',
    label: 'Reach',
    color: 'var(--chart-2)',
    icon: Radar,
    description: 'How broadly you leverage available capabilities. Using diverse tools, subagents, and custom skills means you\'re getting more out of the AI assistant.',
    metrics: ['Tool diversity (35%)', 'Subagent parallelization (35%)', 'Skill/command adoption (30%)'],
  },
  {
    key: 'autonomy',
    letter: 'A',
    label: 'Autonomy',
    color: 'var(--chart-3)',
    icon: Bot,
    description: 'How independently the agent works for you. High autonomy means clear prompts, fewer interruptions, the agent reading before editing, and trusting it with permissions.',
    metrics: ['Assistant/user message ratio (25%)', 'Low interruption rate (25%)', 'Read-before-edit ratio (25%)', 'Permission trust level (25%)'],
  },
  {
    key: 'flow',
    letter: 'F',
    label: 'Flow',
    color: 'var(--chart-4)',
    icon: Activity,
    description: 'How consistently you maintain a coding rhythm. Regular usage builds mastery faster than sporadic intense sessions.',
    metrics: ['Current streak length (35%)', 'Daily consistency (35%)', 'Active days coverage (30%)'],
  },
  {
    key: 'throughput',
    letter: 'T',
    label: 'Throughput',
    color: 'var(--chart-6)',
    icon: Gauge,
    description: 'How much output you get for your investment. Efficient sessions produce more output per dollar with fewer errors, and parallel sessions multiply your throughput.',
    metrics: ['Cost efficiency (25%)', 'Output volume (25%)', 'Parallel sessions (25%)', 'Low error rate (25%)'],
  },
]

function FitnessRing({ score, label }: { score: number; label: string }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const getColor = (s: number) => {
    if (s >= 85) return 'var(--chart-2)'
    if (s >= 70) return 'var(--chart-1)'
    if (s >= 55) return 'var(--chart-3)'
    return 'var(--chart-5)'
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
          <circle
            cx="90" cy="90" r={radius}
            fill="none" stroke={getColor(score)} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            transform="rotate(-90 90 90)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold">{score}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  )
}

function DimensionBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  )
}

function InsightCard({ insight }: { insight: CoachInsight }) {
  const style = SEVERITY_STYLES[insight.severity]
  const SeverityIcon = style.icon

  return (
    <div className={`rounded-lg border border-l-4 ${style.border} p-4`}>
      <div className="flex items-start gap-3">
        <SeverityIcon className={`h-5 w-5 shrink-0 mt-0.5 ${style.iconClass}`} />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{insight.title}</h4>
            {insight.metric && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium shrink-0">
                {insight.metric}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{insight.description}</p>
          {insight.recommendation && (
            <div className="rounded-md bg-muted/50 p-2.5 text-sm">
              <span className="font-medium">Recommendation: </span>
              {insight.recommendation}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AgentCoach({ data }: { data: UsageData }) {
  const coach = useMemo(() => generateCoachInsights(data), [data])
  const [cmdInsights, setCmdInsights] = useState<CommandInsight[]>([])

  useEffect(() => {
    fetch('/api/command-insights')
      .then(r => r.json())
      .then(setCmdInsights)
      .catch(() => {})
  }, [])

  const allInsights: CoachInsight[] = [
    ...coach.insights,
    ...cmdInsights.map(i => ({ ...i, category: 'discovery' as InsightCategory, craft: 'reach' as CraftDimension })),
  ]

  // Group insights by CRAFT dimension
  const insightsByDimension = (dim: CraftDimension) =>
    allInsights.filter(i => i.craft === dim)

  // Ungrouped insights (no craft tag)
  const ungroupedWarnings = allInsights.filter(i => !i.craft && i.severity === 'warning')
  const ungroupedTips = allInsights.filter(i => !i.craft && i.severity === 'tip')
  const ungroupedAchievements = allInsights.filter(i => !i.craft && i.severity === 'achievement')

  return (
    <div className="space-y-6">
      {/* Hero: CRAFT Score + Framework Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>CRAFT Score</CardTitle>
            <CardDescription>
              Your overall AI coding proficiency, measured across 5 dimensions
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <FitnessRing score={coach.score} label={coach.scoreLabel} />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5" />
                  {coach.stats.currentStreak > 0 ? `${coach.stats.currentStreak}d streak` : 'No streak'}
                  {coach.stats.longestStreak > 0 && (
                    <span className="text-xs"> (best: {coach.stats.longestStreak}d)</span>
                  )}
                </span>
              </div>
              <div className="space-y-2">
                {CRAFT_DIMENSIONS.map(({ key, letter, label, color }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-5 text-xs font-bold" style={{ color }}>{letter}</span>
                    <span className="w-20 text-xs text-muted-foreground">{label}</span>
                    <DimensionBar value={coach.craft[key]} color={color} />
                    <span className="w-7 text-xs font-semibold text-right">{coach.craft[key]}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Weights: A 25% · C/R/T 20% each · F 15%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What is CRAFT */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>What is CRAFT?</CardTitle>
            <CardDescription>
              A framework for measuring Human-AI coding proficiency
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p className="text-muted-foreground">
              Every CRAFT metric is derived directly from your local conversation logs.
              No external integrations or surveys needed.
            </p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {CRAFT_DIMENSIONS.map(({ letter, label, color, icon: Icon }) => (
                <div key={letter} className="space-y-1">
                  <div className="flex justify-center">
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div className="text-xs font-bold" style={{ color }}>{letter}</div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Each dimension is scored 0-100 based on your actual usage patterns. The overall score is a
              weighted average prioritizing behavioral quality (Autonomy) over volume (Throughput).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-dimension breakdown with insights */}
      {CRAFT_DIMENSIONS.map(({ key, letter, label, color, icon: Icon, description, metrics }) => {
        const dimInsights = insightsByDimension(key)
        const dimScore = coach.craft[key]
        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-lg font-bold" style={{ color }}>{letter}</span>
                      {label}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color }}>{dimScore}</div>
                  <div className="text-xs text-muted-foreground">/ 100</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* How this score is calculated */}
              <div className="rounded-md bg-muted/50 p-3">
                <div className="text-xs font-medium mb-2">How this score is calculated:</div>
                <div className="grid gap-1">
                  {metrics.map((m) => (
                    <div key={m} className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                      {m}
                    </div>
                  ))}
                </div>
              </div>

              {/* Score bar */}
              <div className="flex items-center gap-3">
                <DimensionBar value={dimScore} color={color} />
                <span className="text-sm font-semibold w-10 text-right">{dimScore}/100</span>
              </div>

              {/* Insights for this dimension */}
              {dimInsights.length > 0 ? (
                <div className="space-y-3">
                  {dimInsights.map(i => <InsightCard key={i.id} insight={i} />)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No specific insights for this dimension yet.</p>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Ungrouped insights (if any) */}
      {(ungroupedWarnings.length > 0 || ungroupedTips.length > 0 || ungroupedAchievements.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Other Insights</CardTitle>
            <CardDescription>General recommendations not tied to a specific CRAFT dimension</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...ungroupedWarnings, ...ungroupedTips, ...ungroupedAchievements].map(i => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Session Averages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Session Averages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <div className="text-muted-foreground">Cost / Session</div>
              <div className="font-semibold">{formatCost(coach.stats.avgCostPerSession)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-semibold">{formatDuration(coach.stats.avgDurationMinutes)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Messages</div>
              <div className="font-semibold">{formatNumber(Math.round(coach.stats.avgMessagesPerSession))}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Peak Hour</div>
              <div className="font-semibold">{coach.stats.peakHour}:00</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
