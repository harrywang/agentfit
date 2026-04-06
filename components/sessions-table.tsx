'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PaginationControls } from '@/components/pagination-controls'
import { usePagination } from '@/hooks/use-pagination'
import { AnalyzeConfirmDialog } from '@/components/analyze-confirm-dialog'
import { Eye, Sparkles, Loader2 } from 'lucide-react'
import type { SessionSummary } from '@/lib/parse-logs'
import { formatCost, formatTokens, formatDuration, formatNumber } from '@/lib/format'

export function SessionsTable({ sessions }: { sessions: SessionSummary[] }) {
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set())
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
  const [hasApiKey, setHasApiKey] = useState(false)
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkEstimate, setBulkEstimate] = useState<{
    sessionCount: number
    messageCount: number
    estimatedCostUSD: number
  } | null>(null)
  const [bulkSessionIds, setBulkSessionIds] = useState<string[]>([])

  const loadAnalysisStatus = useCallback(async () => {
    try {
      const [analyzeRes, configRes] = await Promise.all([
        fetch('/api/analyze?status=true'),
        fetch('/api/config'),
      ])
      const analyzeData = await analyzeRes.json()
      const configData = await configRes.json()
      if (analyzeData.analyses) {
        setAnalyzedIds(new Set(analyzeData.analyses.map((a: { sessionId: string }) => a.sessionId)))
      }
      setHasApiKey(configData.hasOpenAIKey || false)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadAnalysisStatus()
  }, [loadAnalysisStatus])

  async function handleAnalyzeOne(sessionId: string) {
    setAnalyzingIds((prev) => new Set(prev).add(sessionId))
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (res.ok) {
        setAnalyzedIds((prev) => new Set(prev).add(sessionId))
      }
    } catch {
      // ignore
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    }
  }

  async function handleBulkClick() {
    const unanalyzed = filtered
      .filter((s) => !analyzedIds.has(s.sessionId))
      .map((s) => s.sessionId)

    if (unanalyzed.length === 0) return

    setBulkSessionIds(unanalyzed)
    setBulkEstimate(null)
    setConfirmOpen(true)

    try {
      const res = await fetch('/api/analyze/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: unanalyzed }),
      })
      const data = await res.json()
      setBulkEstimate({
        sessionCount: unanalyzed.length,
        messageCount: data.messageCount,
        estimatedCostUSD: data.estimatedCostUSD,
      })
    } catch {
      setConfirmOpen(false)
    }
  }

  async function handleBulkConfirm() {
    setConfirmOpen(false)
    setBulkAnalyzing(true)

    for (const sessionId of bulkSessionIds) {
      setAnalyzingIds((prev) => new Set(prev).add(sessionId))
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        if (res.ok) {
          setAnalyzedIds((prev) => new Set(prev).add(sessionId))
        }
      } catch {
        // continue with next
      } finally {
        setAnalyzingIds((prev) => {
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })
      }
    }

    setBulkAnalyzing(false)
  }

  const projects = [...new Set(sessions.map((s) => s.project))].sort()
  const filtered =
    projectFilter === 'all' ? sessions : sessions.filter((s) => s.project === projectFilter)

  const pagination = usePagination(filtered, 20)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>{filtered.length} sessions recorded</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasApiKey && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkClick}
                disabled={bulkAnalyzing || filtered.every((s) => analyzedIds.has(s.sessionId))}
              >
                {bulkAnalyzing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                <Sparkles className="mr-1 h-3 w-3" />
                Analyze All
              </Button>
            )}
            <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v ?? 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Tools</TableHead>
              <TableHead className="text-center">AI</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.pageItems.map((s) => (
              <TableRow key={s.sessionId} className="hover:bg-muted/50">
                <TableCell className="whitespace-nowrap text-sm">
                  {s.startTime ? new Date(s.startTime).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{s.project}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.model}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(s.userMessages)} / {formatNumber(s.assistantMessages)}
                </TableCell>
                <TableCell className="text-right">{formatTokens(s.totalTokens)}</TableCell>
                <TableCell className="text-right">{formatCost(s.costUSD)}</TableCell>
                <TableCell className="text-right">{formatDuration(s.durationMinutes)}</TableCell>
                <TableCell className="text-right">{formatNumber(s.toolCallsTotal)}</TableCell>
                <TableCell className="text-center">
                  {analyzedIds.has(s.sessionId) ? (
                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-600">
                      Done
                    </Badge>
                  ) : analyzingIds.has(s.sessionId) ? (
                    <Loader2 className="h-3 w-3 animate-spin mx-auto text-muted-foreground" />
                  ) : hasApiKey ? (
                    <button
                      onClick={() => handleAnalyzeOne(s.sessionId)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Analyze with AI"
                    >
                      <Sparkles className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/sessions/${s.sessionId}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Eye className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls pagination={pagination} noun="sessions" />
        <AnalyzeConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirm={handleBulkConfirm}
          loading={bulkAnalyzing}
          estimate={bulkEstimate}
        />
      </CardContent>
    </Card>
  )
}
