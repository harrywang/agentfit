'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { PaginationControls } from '@/components/pagination-controls'
import { usePagination } from '@/hooks/use-pagination'
import { formatCost, formatNumber } from '@/lib/format'
import {
  Camera,
  Zap,
  Clock,
  TrendingUp,
  Image as ImageIcon,
} from 'lucide-react'

interface ImageInfo {
  filename: string
  sessionId: string
  timestamp: string
  sizeBytes: number
  project: string
}

interface ImageAnalysis {
  overview: {
    totalImages: number
    sessionsWithImages: number
    totalSessions: number
    percentWithImages: number
    totalSizeMB: number
    avgSizeKB: number
    byMediaType: Record<string, number>
  }
  byProject: { name: string; count: number }[]
  byHour: { hour: number; count: number }[]
  byDate: { date: string; count: number }[]
  comparison: {
    withImages: { sessions: number; avgMessages: number; avgCost: number; avgDuration: number; avgTools: number }
    withoutImages: { sessions: number; avgMessages: number; avgCost: number; avgDuration: number; avgTools: number }
  }
  screenshotFrequency: {
    totalGaps: number
    medianMinutes: number
    meanMinutes: number
    rapidFireCount: number
    rapidFirePercent: number
    under5Count: number
    under5Percent: number
  }
  topSessions: {
    sessionId: string
    imageCount: number
    project: string
    messages: number
    cost: number
    date: string
  }[]
  allImages: ImageInfo[]
}

const projectConfig = {
  count: { label: 'Images', color: 'var(--chart-3)' },
} satisfies ChartConfig

const hourConfig = {
  count: { label: 'Images', color: 'var(--chart-1)' },
} satisfies ChartConfig

const dateConfig = {
  count: { label: 'Images', color: 'var(--chart-8)' },
} satisfies ChartConfig

const comparisonConfig = {
  withImages: { label: 'With Images', color: 'var(--chart-1)' },
  withoutImages: { label: 'Text Only', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function ScreenshotsAnalysis() {
  const [data, setData] = useState<ImageAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/images-analysis')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-muted-foreground">Loading image analysis...</div>
  if (!data) return <div className="text-muted-foreground">No image data available</div>

  const { overview, comparison, screenshotFrequency } = data

  const costMultiplier = comparison.withoutImages.avgCost > 0
    ? (comparison.withImages.avgCost / comparison.withoutImages.avgCost).toFixed(1)
    : '?'
  const msgMultiplier = comparison.withoutImages.avgMessages > 0
    ? (comparison.withImages.avgMessages / comparison.withoutImages.avgMessages).toFixed(1)
    : '?'

  const comparisonData = [
    {
      metric: 'Avg Cost',
      withImages: comparison.withImages.avgCost,
      withoutImages: comparison.withoutImages.avgCost,
    },
    {
      metric: 'Avg Messages',
      withImages: comparison.withImages.avgMessages,
      withoutImages: comparison.withoutImages.avgMessages,
    },
    {
      metric: 'Avg Tools',
      withImages: comparison.withImages.avgTools,
      withoutImages: comparison.withoutImages.avgTools,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hero insight */}
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Camera className="h-8 w-8 text-chart-1 mt-1 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold mb-1">Sessions with Images Cost {costMultiplier}x More</h2>
              <p className="text-sm text-muted-foreground">
                Sessions where you shared images averaged <strong>{formatCost(comparison.withImages.avgCost)}</strong> vs{' '}
                <strong>{formatCost(comparison.withoutImages.avgCost)}</strong> for text-only sessions.
                They also had <strong>{msgMultiplier}x</strong> more messages and{' '}
                <strong>{Math.round(comparison.withImages.avgTools / Math.max(1, comparison.withoutImages.avgTools))}x</strong> more tool calls.
                Images signal complex visual work — UI debugging, design review, and iterative refinement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Images</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(overview.totalImages)}</div>
            <p className="text-xs text-muted-foreground">{overview.totalSizeMB} MB on disk</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessions with Images</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.percentWithImages}%</div>
            <p className="text-xs text-muted-foreground">{overview.sessionsWithImages} of {overview.totalSessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Size</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.avgSizeKB} KB</div>
            <p className="text-xs text-muted-foreground">{overview.byMediaType['image/png'] || 0} PNG, {overview.byMediaType['image/jpeg'] || 0} JPEG</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rapid Fire</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{screenshotFrequency.rapidFirePercent}%</div>
            <p className="text-xs text-muted-foreground">{screenshotFrequency.rapidFireCount} sent &lt;2 min apart</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Median Gap</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{screenshotFrequency.medianMinutes} min</div>
            <p className="text-xs text-muted-foreground">Between consecutive images</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison chart + By hour */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Image vs Text-Only Sessions</CardTitle>
            <CardDescription>Average metrics comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={comparisonConfig} className="min-h-[300px] w-full">
              <BarChart data={comparisonData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="metric" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="withImages" fill="var(--color-withImages)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withoutImages" fill="var(--color-withoutImages)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Images by Hour</CardTitle>
            <CardDescription>When do you share images?</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hourConfig} className="min-h-[300px] w-full">
              <BarChart data={data.byHour} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(h) => `${h}:00`}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(h) => `${h}:00 - ${h}:59`}
                    />
                  }
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Daily timeline + By project */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Image Activity</CardTitle>
            <CardDescription>Images shared per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dateConfig} className="min-h-[300px] w-full">
              <BarChart data={data.byDate} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Images by Project</CardTitle>
            <CardDescription>Which projects need the most visual feedback?</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={projectConfig} className="min-h-[300px] w-full">
              <BarChart data={data.byProject} layout="vertical" accessibilityLayer margin={{ left: 8 }}>
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={80} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Most image-heavy sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Most Image-Heavy Sessions</CardTitle>
          <CardDescription>Your biggest visual collaboration marathons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.topSessions.map((s, i) => (
              <div key={s.sessionId} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant={i < 3 ? 'default' : 'secondary'} className="text-xs">
                    #{i + 1}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{s.date}</span>
                </div>
                <div className="text-2xl font-bold">{s.imageCount}</div>
                <div className="text-xs text-muted-foreground">images</div>
                <div className="text-xs">
                  <span className="text-muted-foreground">{s.project}</span>
                  {' · '}{formatCost(s.cost)}{' · '}{formatNumber(s.messages)} msgs
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All images grid with pagination */}
      <ImageGallery images={data.allImages} />
    </div>
  )
}

function ImageGallery({ images }: { images: ImageInfo[] }) {
  const pagination = usePagination(images, 16)

  if (images.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Images</CardTitle>
        <CardDescription>{images.length} images across all sessions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pagination.pageItems.map((img) => (
            <div
              key={img.filename}
              className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            >
              <img
                src={`/api/images/${img.filename}`}
                alt={`Image from ${img.project}`}
                className="aspect-video w-full object-cover object-top"
                loading="lazy"
              />
              <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{img.project}</span>
                <span>{new Date(img.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span>{Math.round(img.sizeBytes / 1024)} KB</span>
              </div>
            </div>
          ))}
        </div>
        <PaginationControls pagination={pagination} noun="images" />
      </CardContent>
    </Card>
  )
}
