'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check, Circle, Terminal, Lightbulb, Sparkles, TrendingUp } from 'lucide-react'
import type { CommandAnalysis } from '@/lib/commands'

function CategoryBar({ name, used, total, invocations }: {
  name: string
  used: number
  total: number
  invocations: number
}) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0
  const getColor = (p: number) => {
    if (p >= 75) return 'bg-chart-2'
    if (p >= 50) return 'bg-chart-1'
    if (p >= 25) return 'bg-chart-3'
    return 'bg-chart-5'
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">
          {used}/{total} commands ({invocations} uses)
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(pct)}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  )
}

export function CommandUsage() {
  const [analysis, setAnalysis] = useState<CommandAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'used' | 'unused'>('all')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/commands')
        const data = await res.json()
        setAnalysis(data)
      } catch (e) {
        console.error('Failed to load command analysis:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading command usage...
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="text-destructive py-12 text-center">
        Failed to load command analysis
      </div>
    )
  }

  const filteredCommands = analysis.commands.filter(cmd => {
    if (filter === 'used') return cmd.used
    if (filter === 'unused') return !cmd.used
    return true
  })

  // Pick top unused recommendations
  const recommendations = analysis.commands
    .filter(c => !c.used)
    .filter(c => [
      '/compact', '/diff', '/context', '/btw', '/branch', '/export',
      '/plan', '/stats', '/insights', '/security-review', '/doctor',
      '/cost', '/memory', '/hooks', '/keybindings',
    ].includes(c.command))
    .slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Built-in Commands</span>
            </div>
            <div className="text-3xl font-bold mt-1">{analysis.totalCommands}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-chart-2" />
              <span className="text-sm text-muted-foreground">Commands Used</span>
            </div>
            <div className="text-3xl font-bold mt-1">
              {analysis.usedCommands}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Usage Rate</span>
            </div>
            <div className="text-3xl font-bold mt-1">{analysis.usagePercentage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Invocations</span>
            </div>
            <div className="text-3xl font-bold mt-1">{analysis.totalInvocations}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage by Category</CardTitle>
          <CardDescription>How many commands you've used in each category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(analysis.categories)
            .sort(([, a], [, b]) => b.invocations - a.invocations)
            .map(([name, stats]) => (
              <CategoryBar
                key={name}
                name={name}
                used={stats.used}
                total={stats.total}
                invocations={stats.invocations}
              />
            ))}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-chart-3" />
              <div>
                <CardTitle>Recommended Commands to Try</CardTitle>
                <CardDescription>
                  Useful commands you haven't used yet
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {recommendations.map(cmd => (
                <div key={cmd.command} className="flex items-start gap-3 rounded-lg border p-3">
                  <code className="shrink-0 rounded bg-muted px-2 py-0.5 text-sm font-semibold text-primary">
                    {cmd.command}
                  </code>
                  <span className="text-sm text-muted-foreground">{cmd.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom commands (skills/plugins) */}
      {analysis.customCommands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Commands (Skills & Plugins)</CardTitle>
            <CardDescription>
              Non-built-in commands you've used — these come from installed skills and plugins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.customCommands.map(({ command, count }) => (
                <Badge key={command} variant="secondary" className="gap-1.5 text-sm">
                  <code>{command}</code>
                  <span className="text-muted-foreground">{count}x</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full command table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Commands</CardTitle>
              <CardDescription>
                Complete list of built-in Claude Code commands
              </CardDescription>
            </div>
            <div className="flex gap-1.5">
              {(['all', 'used', 'unused'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f === 'all' ? `All (${analysis.totalCommands})` :
                   f === 'used' ? `Used (${analysis.usedCommands})` :
                   `Unused (${analysis.unusedCommands})`}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Uses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommands.map(cmd => (
                <TableRow key={cmd.command} className={cmd.used ? '' : 'opacity-60'}>
                  <TableCell>
                    {cmd.used ? (
                      <Check className="h-4 w-4 text-chart-2" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-semibold">{cmd.command}</code>
                      {cmd.aliases && cmd.aliases.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({cmd.aliases.join(', ')})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cmd.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{cmd.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {cmd.count > 0 ? cmd.count : '–'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
