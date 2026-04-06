'use client'

import { useData } from '@/components/data-provider'
import { FitnessScore } from '@/components/fitness-score'
import { OverviewCards } from '@/components/overview-cards'
import { DailyCostChart, TopCommandsChart, TokenUsageHeatmap, UserVsAssistantChart, InterruptionRateChart, ToolMixChart } from '@/components/daily-chart'
import { VersionLagChart } from '@/components/version-lag-chart'
import { RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const { data, newSessionsAvailable, handleSync, syncing } = useData()
  if (!data) return null

  return (
    <>
      {newSessionsAvailable > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span>
            <strong>{newSessionsAvailable}</strong> new session{newSessionsAvailable !== 1 ? 's' : ''} detected on disk. Sync to update your dashboard.
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      )}
      <FitnessScore data={data} />
      <OverviewCards overview={data.overview} sessions={data.sessions} />
      <div className="grid gap-4 lg:grid-cols-3">
        <DailyCostChart daily={data.daily} />
        <TopCommandsChart />
        <TokenUsageHeatmap daily={data.daily} />
        <UserVsAssistantChart daily={data.daily} />
        <InterruptionRateChart daily={data.daily} />
        <ToolMixChart daily={data.daily} />
        <VersionLagChart sessions={data.sessions} />
      </div>
    </>
  )
}
