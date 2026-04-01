'use client'

import { DataProvider } from '@/components/data-provider'
import { DashboardShell } from '@/components/dashboard-shell'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <DashboardShell>{children}</DashboardShell>
      <Toaster />
    </DataProvider>
  )
}
