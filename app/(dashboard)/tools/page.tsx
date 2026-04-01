'use client'

import { useData } from '@/components/data-provider'
import { ToolUsageChart } from '@/components/tool-usage-chart'

export default function ToolsPage() {
  const { data } = useData()
  if (!data) return null

  return <ToolUsageChart toolUsage={data.toolUsage} />
}
