'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Eye } from 'lucide-react'
import type { SessionSummary } from '@/lib/parse-logs'
import { formatCost, formatTokens, formatDuration, formatNumber } from '@/lib/format'

export function SessionsTable({ sessions }: { sessions: SessionSummary[] }) {
  const [projectFilter, setProjectFilter] = useState<string>('all')

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
      </CardContent>
    </Card>
  )
}
