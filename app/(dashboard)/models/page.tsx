'use client'

import { useData } from '@/components/data-provider'
import { ModelDistributionChart, ModelUsageOverTimeChart } from '@/components/model-usage-chart'
import { VersionLagChart } from '@/components/version-lag-chart'

export default function ModelsPage() {
  const { data } = useData()
  if (!data) return null

  return (
    <>
      <h1 className="text-2xl font-bold">Model Usage</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <ModelDistributionChart sessions={data.sessions} />
        <VersionLagChart sessions={data.sessions} />
      </div>
      <ModelUsageOverTimeChart sessions={data.sessions} />
    </>
  )
}
