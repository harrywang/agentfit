'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Brain,
  Camera,
  ChevronRight,
  Coins,
  FileText,
  FolderOpen,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  ListTree,
  Puzzle,
  Settings,
  Terminal,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getPlugins } from '@/lib/plugins'
import '@/plugins'

interface NavItem {
  title: ReactNode
  icon: ComponentType<{ className?: string }>
  href: string
}

interface NavGroup {
  title: string
  icon: ComponentType<{ className?: string }>
  items: NavItem[]
}

const topItems: NavItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { title: 'CRAFT Coach', icon: HeartPulse, href: '/coach' },
]

const navGroups: NavGroup[] = [
  {
    title: 'Projects',
    icon: FolderOpen,
    items: [
      { title: 'Overview', icon: FolderOpen, href: '/projects' },
      { title: 'Sessions', icon: ListTree, href: '/sessions' },
    ],
  },
  {
    title: 'Usage',
    icon: BarChart3,
    items: [
      { title: 'Daily Usage', icon: BarChart3, href: '/daily' },
      { title: 'Token Breakdown', icon: Coins, href: '/tokens' },
      { title: 'Tool Usage', icon: Wrench, href: '/tools' },
      { title: 'Command Usage', icon: Terminal, href: '/commands' },
    ],
  },
  {
    title: 'Insights',
    icon: Brain,
    items: [
      { title: 'Personality Fit', icon: Brain, href: '/personality' },
      { title: 'Session Flow', icon: GitBranch, href: '/flow' },
      { title: 'Image Analysis', icon: Camera, href: '/images' },
      { title: 'Reports', icon: FileText, href: '/reports' },
    ],
  },
]

function CollapsibleGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const isActive = group.items.some((item) => pathname === item.href)
  const [open, setOpen] = useState(isActive)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setOpen(!open)}>
        <group.icon className="h-4 w-4" />
        <span>{group.title}</span>
        <ChevronRight
          className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {group.items.map((item) => (
            <SidebarMenuSubItem key={item.href}>
              <SidebarMenuSubButton
                render={<Link href={item.href} />}
                isActive={pathname === item.href}
              >
                <span>{item.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const plugins = getPlugins()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <img src="/logo.svg" alt="AgentFit" className="h-8 w-8" />
          <div className="text-sm font-semibold">AgentFit</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="sr-only">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {topItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {navGroups.map((group) => (
                <CollapsibleGroup key={group.title} group={group} pathname={pathname} />
              ))}
              {plugins.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/community" />}
                    isActive={pathname.startsWith('/community')}
                  >
                    <Puzzle className="h-4 w-4" />
                    <span>Community</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/data-management" />}
                  isActive={pathname === '/data-management'}
                >
                  <Settings className="h-4 w-4" />
                  <span>Data Management</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-center px-3 py-2 text-xs text-muted-foreground">
          <a
            href="https://github.com/harrywang/agentfit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
