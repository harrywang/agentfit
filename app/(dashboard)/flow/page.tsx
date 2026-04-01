'use client'

import { useData } from '@/components/data-provider'
import { ToolFlowGraph } from '@/components/tool-flow-graph'
import { SessionTimeline } from '@/components/session-timeline'

export default function FlowPage() {
  const { data } = useData()
  if (!data) return null

  return (
    <>
      <SessionTimeline sessions={data.sessions} />
      <ToolFlowGraph data={data} />
    </>
  )
}
