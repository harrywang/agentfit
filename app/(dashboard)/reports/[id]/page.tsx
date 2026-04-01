'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ReportView } from '@/components/report-view'
import type { ReportContent } from '@/lib/report'

interface ReportData {
  id: string
  title: string
  generatedAt: string
  contentJson: ReportContent
  sessionCount: number
}

export default function ReportDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reports/${id}`)
        if (!res.ok) throw new Error('Report not found')
        setReport(await res.json())
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading report...
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
        <div className="text-destructive">{error || 'Report not found'}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
        <span className="text-xs text-muted-foreground">
          Generated {new Date(report.generatedAt).toLocaleString()} · {report.sessionCount} sessions
        </span>
      </div>
      <ReportView content={report.contentJson} />
    </div>
  )
}
