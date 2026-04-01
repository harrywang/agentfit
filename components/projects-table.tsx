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
import type { ProjectSummary } from '@/lib/parse-logs'
import { formatCost, formatTokens, formatDuration, formatNumber } from '@/lib/format'

export function ProjectsTable({ projects }: { projects: ProjectSummary[] }) {
  const pagination = usePagination(projects, 20)

  const topTools = (toolCalls: Record<string, number>) =>
    Object.entries(toolCalls)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count})`)
      .join(', ')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>{projects.length} projects tracked</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Top Tools</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.pageItems.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right">{formatNumber(p.sessions)}</TableCell>
                <TableCell className="text-right">{formatNumber(p.totalMessages)}</TableCell>
                <TableCell className="text-right">{formatTokens(p.totalTokens)}</TableCell>
                <TableCell className="text-right">{formatCost(p.totalCost)}</TableCell>
                <TableCell className="text-right">
                  {formatDuration(p.totalDurationMinutes)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {topTools(p.toolCalls)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pagination.totalPages > 1 && (
          <PaginationControls pagination={pagination} noun="projects" />
        )}
      </CardContent>
    </Card>
  )
}
