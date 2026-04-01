'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, Plus, Loader2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/components/data-provider'

interface ReportSummary {
  id: string
  title: string
  generatedAt: string
  sessionCount: number
}

export default function ReportsPage() {
  const { data } = useData()
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  async function fetchReports() {
    try {
      const res = await fetch('/api/reports')
      setReports(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReports() }, [])

  const currentSessionCount = data?.overview.totalSessions || 0
  const lastReportSessionCount = reports[0]?.sessionCount || 0
  const hasNewData = reports.length === 0 || currentSessionCount !== lastReportSessionCount

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/reports', { method: 'POST' })
      const report = await res.json()
      if (res.status === 409) {
        toast.info('No new data', { description: report.error })
        return
      }
      if (!res.ok) throw new Error(report.error || 'Failed to generate report')
      toast.success('Report generated', { description: report.title })
      await fetchReports()
    } catch (e) {
      toast.error('Failed to generate report', { description: (e as Error).message })
    } finally {
      setGenerating(false)
    }
  }

  const buttonDisabled = generating || !hasNewData

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Insights Reports</h2>
          <p className="text-sm text-muted-foreground">
            Generate point-in-time snapshots of your coding agent fitness
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={<span />}
          >
            <Button onClick={handleGenerate} disabled={buttonDisabled} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
          </TooltipTrigger>
          {!hasNewData && (
            <TooltipContent>
              No new sessions since last report. Sync new data first.
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No reports yet. Click "Generate Report" to create your first fitness snapshot.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map(report => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{report.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(report.generatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {report.sessionCount} sessions
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
