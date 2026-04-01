'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Trophy, AlertTriangle, Lightbulb, Brain, Flame, Wrench, Clock,
  MessageSquare, FolderOpen, LayoutList, DollarSign, Terminal,
  Zap, Search, Ban, Calendar,
} from 'lucide-react'
import { formatCost, formatDuration, formatNumber, formatTokens } from '@/lib/format'
import type { ReportContent } from '@/lib/report'
import type { CoachInsight, InsightSeverity, InsightCategory } from '@/lib/coach'

// ─── Score Ring ──────────────────────────────────────────────────────

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
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
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth="9" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={getColor(score)} strokeWidth="9"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-bold" style={{ fontSize: size * 0.22 }}>{score}</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: size * 0.09 }}>/ 100</text>
    </svg>
  )
}

// ─── Insight Card ────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<InsightSeverity, string> = {
  achievement: 'border-l-chart-2',
  warning: 'border-l-chart-5',
  tip: 'border-l-chart-1',
}

const SEVERITY_ICON: Record<InsightSeverity, typeof Trophy> = {
  achievement: Trophy,
  warning: AlertTriangle,
  tip: Lightbulb,
}

function InsightCard({ insight }: { insight: CoachInsight }) {
  const Icon = SEVERITY_ICON[insight.severity]
  return (
    <div className={`rounded-lg border border-l-4 ${SEVERITY_BORDER[insight.severity]} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <div className="space-y-1">
          <div className="text-sm font-semibold">{insight.title}</div>
          <p className="text-xs text-muted-foreground">{insight.description}</p>
          {insight.recommendation && (
            <div className="rounded-md bg-muted/50 p-2 text-xs mt-2">{insight.recommendation}</div>
          )}
        </div>
        {insight.metric && (
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-mono">{insight.metric}</span>
        )}
      </div>
    </div>
  )
}

// ─── Main Report View ────────────────────────────────────────────────

export function ReportView({ content }: { content: ReportContent }) {
  const g = content.atAGlance

  return (
    <div className="space-y-6 max-w-4xl">
      {/* At a Glance */}
      <Card>
        <CardHeader>
          <CardTitle>At a Glance</CardTitle>
          <CardDescription>{g.dateRange.from} to {g.dateRange.to}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <ScoreRing score={g.fitnessScore} />
            <div className="flex-1">
              <div className="text-lg font-semibold mb-1">Fitness: {g.scoreLabel}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Flame className="h-3.5 w-3.5" />
                {g.currentStreak > 0 ? `${g.currentStreak}d streak` : 'No active streak'}
                {g.longestStreak > 0 && <span>(best: {g.longestStreak}d)</span>}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <div><span className="text-muted-foreground">Sessions</span><div className="font-semibold">{formatNumber(g.totalSessions)}</div></div>
                <div><span className="text-muted-foreground">Projects</span><div className="font-semibold">{formatNumber(g.totalProjects)}</div></div>
                <div><span className="text-muted-foreground">Messages</span><div className="font-semibold">{formatNumber(g.totalMessages)}</div></div>
                <div><span className="text-muted-foreground">Total Time</span><div className="font-semibold">{formatDuration(g.totalDurationMinutes)}</div></div>
                <div><span className="text-muted-foreground">Tool Calls</span><div className="font-semibold">{formatNumber(g.totalToolCalls)}</div></div>
                <div><span className="text-muted-foreground">Total Cost</span><div className="font-semibold">{formatCost(g.totalCostUSD)}</div></div>
                <div><span className="text-muted-foreground">API Errors</span><div className="font-semibold">{formatNumber(g.totalApiErrors)}</div></div>
                <div><span className="text-muted-foreground">Interruptions</span><div className="font-semibold">{formatNumber(g.totalUserInterruptions)}</div></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Areas */}
      {content.projectAreas.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>What You Work On</CardTitle>
                <CardDescription>Top projects by session count</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Top Tools</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.projectAreas.map(p => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{p.sessions}</TableCell>
                    <TableCell className="text-right">{formatNumber(p.totalMessages)}</TableCell>
                    <TableCell className="text-right">{formatDuration(p.totalDurationMinutes)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.topTools.map(([name, count]) => `${name} (${count})`).join(', ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Interaction Style */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>How You Use Your Agent</CardTitle>
              <CardDescription>Interaction patterns and coding style</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6 mb-4">
            <div>
              <div className="text-3xl font-bold tracking-wider text-primary">{content.interactionStyle.mbtiType}</div>
              <div className="text-xs text-muted-foreground mt-1">{content.interactionStyle.mbtiDescription}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <span className="text-muted-foreground">Avg Messages/Session</span>
              <div className="font-semibold">{Math.round(content.interactionStyle.avgMessagesPerSession)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Duration</span>
              <div className="font-semibold">{formatDuration(content.interactionStyle.avgDurationMinutes)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Read/Edit Ratio</span>
              <div className="font-semibold">{content.interactionStyle.readEditRatio.toFixed(1)}x</div>
            </div>
            <div>
              <span className="text-muted-foreground">Bash Usage</span>
              <div className="font-semibold">{Math.round(content.interactionStyle.bashRatio * 100)}%</div>
            </div>
            <div>
              <span className="text-muted-foreground">Subagent Calls</span>
              <div className="font-semibold">{formatNumber(content.interactionStyle.agentCallsTotal)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Peak Hour</span>
              <div className="font-semibold">{content.interactionStyle.peakHour}:00</div>
            </div>
            <div>
              <span className="text-muted-foreground">Most Active Day</span>
              <div className="font-semibold">{content.interactionStyle.mostActiveDay}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Cost/Session</span>
              <div className="font-semibold">{formatCost(content.interactionStyle.avgCostPerSession)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Works */}
      {content.whatWorks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-chart-2" />
              <div>
                <CardTitle>What's Working</CardTitle>
                <CardDescription>Patterns and habits that are paying off</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.whatWorks.map(i => <InsightCard key={i.id} insight={i} />)}
          </CardContent>
        </Card>
      )}

      {/* Friction Analysis */}
      {content.frictionAnalysis.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-chart-5" />
              <div>
                <CardTitle>Where Things Go Wrong</CardTitle>
                <CardDescription>Friction points that slow you down</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.frictionAnalysis.map(i => <InsightCard key={i.id} insight={i} />)}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-chart-1" />
            <div>
              <CardTitle>Suggestions</CardTitle>
              <CardDescription>Actionable ways to improve your workflow</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CLAUDE.md rules */}
          {content.suggestions.claudeMdRules.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> Add to CLAUDE.md
              </h4>
              <div className="space-y-2">
                {content.suggestions.claudeMdRules.map((rule, i) => (
                  <div key={i} className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">{rule}</div>
                ))}
              </div>
            </div>
          )}

          {/* Coach tips */}
          {content.suggestions.coachTips.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Workflow Tips
              </h4>
              <div className="space-y-3">
                {content.suggestions.coachTips.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </div>
          )}

          {/* Command tips */}
          {content.suggestions.commandTips.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Search className="h-4 w-4" /> Commands to Discover
              </h4>
              <div className="space-y-2">
                {content.suggestions.commandTips.map(i => (
                  <div key={i.id} className="rounded-lg border p-3">
                    <div className="text-sm font-semibold">{i.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{i.description}</p>
                    {i.recommendation && (
                      <div className="rounded-md bg-muted/50 p-2 text-xs mt-2">{i.recommendation}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
