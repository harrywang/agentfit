'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationControls } from '@/components/pagination-controls'
import { usePagination } from '@/hooks/use-pagination'
import type { DailyUsage, SessionSummary } from '@/lib/parse-logs'
import { formatCost, formatTokens, formatNumber } from '@/lib/format'

interface DailyTableProps {
  daily: DailyUsage[]
  sessions: SessionSummary[]
}

function shortModel(name: string): string {
  // Strip the leading "claude-" so the table reads "opus-4-7" / "haiku-4-5"
  return name.replace(/^claude-/, '')
}

export function DailyTable({ daily, sessions }: DailyTableProps) {
  // Fall back to session-derived models for days without modelBreakdowns
  // (happens when the user filters by project on the client — see
  // components/data-provider.tsx).
  const modelsByDate = new Map<string, Set<string>>()
  for (const s of sessions) {
    const date = s.startTime.slice(0, 10)
    if (!modelsByDate.has(date)) modelsByDate.set(date, new Set())
    modelsByDate.get(date)!.add(s.model)
  }

  // Totals
  const totals = daily.reduce(
    (acc, d) => ({
      sessions: acc.sessions + d.sessions,
      messages: acc.messages + d.messages,
      inputTokens: acc.inputTokens + d.inputTokens,
      outputTokens: acc.outputTokens + d.outputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + d.cacheCreationTokens,
      cacheReadTokens: acc.cacheReadTokens + d.cacheReadTokens,
      totalTokens: acc.totalTokens + d.totalTokens,
      costUSD: acc.costUSD + d.costUSD,
    }),
    {
      sessions: 0, messages: 0, inputTokens: 0, outputTokens: 0,
      cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, costUSD: 0,
    }
  )

  // Sort daily by date descending (most recent first)
  const sorted = [...daily].sort((a, b) => b.date.localeCompare(a.date))
  const pagination = usePagination(sorted, 20)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Breakdown</CardTitle>
        <CardDescription>{daily.length} days of activity</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Models</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Cache Create</TableHead>
              <TableHead className="text-right">Cache Read</TableHead>
              <TableHead className="text-right">Total Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.pageItems.map((d) => {
              const modelList =
                d.modelBreakdowns.length > 0
                  ? d.modelBreakdowns.map((b) => b.model)
                  : Array.from(modelsByDate.get(d.date) ?? []).sort()
              return (
                <TableRow key={d.date}>
                  <TableCell className="font-medium whitespace-nowrap align-top">{d.date}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] align-top">
                    {modelList.map((m) => (
                      <div key={m}>- {shortModel(m)}</div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right align-top">{d.sessions}</TableCell>
                  <TableCell className="text-right font-mono text-xs align-top">{formatNumber(d.inputTokens)}</TableCell>
                  <TableCell className="text-right font-mono text-xs align-top">{formatNumber(d.outputTokens)}</TableCell>
                  <TableCell className="text-right font-mono text-xs align-top">{formatNumber(d.cacheCreationTokens)}</TableCell>
                  <TableCell className="text-right font-mono text-xs align-top">{formatNumber(d.cacheReadTokens)}</TableCell>
                  <TableCell className="text-right font-mono text-xs align-top">{formatNumber(d.totalTokens)}</TableCell>
                  <TableCell className="text-right font-medium align-top">{formatCost(d.costUSD)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableBody>
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>Total</TableCell>
              <TableCell />
              <TableCell className="text-right">{totals.sessions}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatTokens(totals.inputTokens)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatTokens(totals.outputTokens)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatTokens(totals.cacheCreationTokens)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatTokens(totals.cacheReadTokens)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatTokens(totals.totalTokens)}</TableCell>
              <TableCell className="text-right">{formatCost(totals.costUSD)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <PaginationControls pagination={pagination} noun="days" />
      </CardContent>
    </Card>
  )
}
