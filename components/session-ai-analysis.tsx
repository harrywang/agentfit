'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { AnalyzeConfirmDialog } from './analyze-confirm-dialog'
import { formatCost } from '@/lib/format'
import type { MessageClassification } from '@/lib/openai'


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
              width={110}
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

interface AnalysisData {
  classifications: MessageClassification[]
  model: string
  totalMessages: number
  inputTokens: number
  outputTokens: number
  costUSD: number
  analyzedAt: string
}

export function SessionAIAnalysis({ sessionId }: { sessionId: string }) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [estimate, setEstimate] = useState<{
    sessionCount: number
    messageCount: number
    estimatedCostUSD: number
  } | null>(null)

  const loadAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyze?sessionId=${sessionId}`)
      const data = await res.json()
      if (data.analysis) setAnalysis(data.analysis)
    } catch {
      // No analysis yet — that's fine
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    loadAnalysis()
  }, [loadAnalysis])

  async function handleAnalyzeClick() {
    // Fetch estimate
    setEstimate(null)
    setConfirmOpen(true)
    try {
      const res = await fetch('/api/analyze/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      setEstimate({
        sessionCount: 1,
        messageCount: data.messageCount,
        estimatedCostUSD: data.estimatedCostUSD,
      })
    } catch {
      setError('Failed to estimate cost')
      setConfirmOpen(false)
    }
  }

  async function handleConfirm() {
    setAnalyzing(true)
    setError(null)
    setConfirmOpen(false)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Analysis failed')
      }
      const data = await res.json()
      setAnalysis(data.analysis)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    )
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Sparkles className="h-10 w-10 text-muted-foreground" />
          <div className="text-center space-y-1">
            <p className="font-medium">No AI analysis yet</p>
            <p className="text-sm text-muted-foreground">
              Classify user messages by type, role, skill level, and sentiment
            </p>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          <Button onClick={handleAnalyzeClick} disabled={analyzing}>
            {analyzing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            <Sparkles className="mr-1 h-3 w-3" />
            Analyze with AI
          </Button>
          <AnalyzeConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            onConfirm={handleConfirm}
            loading={analyzing}
            estimate={estimate}
          />
        </CardContent>
      </Card>
    )
  }

  // Build distributions from classifications
  const messageTypes: Record<string, number> = {}
  const roles: Record<string, number> = {}
  const skillLevels: Record<string, number> = {}
  const sentiments: Record<string, number> = {}

  for (const cls of analysis.classifications) {
    messageTypes[cls.messageType] = (messageTypes[cls.messageType] || 0) + 1
    roles[cls.role] = (roles[cls.role] || 0) + 1
    skillLevels[cls.skillLevel] = (skillLevels[cls.skillLevel] || 0) + 1
    sentiments[cls.sentiment] = (sentiments[cls.sentiment] || 0) + 1
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {analysis.totalMessages} messages classified
          </Badge>
          <Badge variant="outline" className="text-xs">
            {analysis.model}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Cost: {formatCost(analysis.costUSD)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DistributionChart
          title="Message Type"
          description="What kind of messages you sent"
          data={messageTypes}
        />
        <DistributionChart
          title="Role"
          description="Professional role implied by each message"
          data={roles}
        />
        <DistributionChart
          title="Skill Level"
          description="Technical skill level of each message"
          data={skillLevels}
        />
        <DistributionChart
          title="Sentiment"
          description="Emotional tone of each message"
          data={sentiments}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Message Classifications</CardTitle>
          <CardDescription>Per-message breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {analysis.classifications.map((cls, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border p-2 text-xs"
              >
                <span className="shrink-0 text-muted-foreground w-6 text-right">
                  {i + 1}.
                </span>
                <span className="flex-1 line-clamp-1">{cls.messagePreview}</span>
                <div className="flex gap-1 shrink-0">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {cls.messageType}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {cls.role}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {cls.skillLevel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 ${
                      cls.sentiment === 'frustrated'
                        ? 'border-destructive text-destructive'
                        : cls.sentiment === 'positive'
                          ? 'border-green-600 text-green-600'
                          : ''
                    }`}
                  >
                    {cls.sentiment}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
