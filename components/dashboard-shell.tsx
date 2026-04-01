'use client'

import { usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppSidebar } from './app-sidebar'
import { useData, type TimeRange, type AgentType } from './data-provider'
import { getPlugin } from '@/lib/plugins'
import '@/plugins' // ensure plugins are registered
import type { ReactNode } from 'react'

const VIEW_TITLES: Record<string, ReactNode> = {
  '/': 'Dashboard',
  '/daily': 'Daily Usage',
  '/tokens': 'Token Breakdown',
  '/tools': 'Tool Usage',
  '/projects': 'Projects',
  '/sessions': 'Sessions',
  '/personality': 'Personality Fit',
  '/commands': 'Command Usage',
  '/images': 'Image Analysis',
  '/coach': 'CRAFT Coach',
  '/flow': 'Session Flow',
  '/community': 'Community',
  '/reports': 'Reports',
  '/data-management': 'Data Management',
}

function resolveTitle(pathname: string): ReactNode {
  if (VIEW_TITLES[pathname]) return VIEW_TITLES[pathname]
  const match = pathname.match(/^\/community\/([a-z0-9-]+)$/)
  if (match) {
    const plugin = getPlugin(match[1])
    if (plugin) return plugin.manifest.name
  }
  if (pathname.startsWith('/reports/')) return 'Report Detail'
  if (pathname.startsWith('/sessions/')) return 'Session Detail'
  return 'Dashboard'
}

const AGENT_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  combined: 'Combined',
}

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
}

// Pages where time range filter doesn't apply
const NO_TIME_FILTER = new Set(['/commands'])

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const {
    agent, setAgent, timeRange, setTimeRange,
    selectedProject, setSelectedProject, allProjects,
    loading,
  } = useData()

  const title = resolveTitle(pathname)
  const communitySlug = pathname.match(/^\/community\/([a-z0-9-]+)$/)?.[1]
  const communityPlugin = communitySlug ? getPlugin(communitySlug) : undefined
  const showTimeFilter =
    !NO_TIME_FILTER.has(pathname) && !communityPlugin?.manifest.customDataSource

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Syncing logs...
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <h1 className="ml-2 text-sm font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {showTimeFilter && (
              <div className="flex rounded-lg border p-0.5">
                {(Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTimeRange(key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      timeRange === key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {key === 'all' ? 'All' : key}
                  </button>
                ))}
              </div>
            )}
            {allProjects.length > 1 && (
              <Select value={selectedProject} onValueChange={(v) => v && setSelectedProject(v)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue>{selectedProject === 'all' ? 'All Projects' : selectedProject}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {allProjects.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={agent} onValueChange={(v) => v && setAgent(v as AgentType)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue>{AGENT_LABELS[agent]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">Claude Code</SelectItem>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="combined">Combined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>
        <main className="flex-1 space-y-6 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
