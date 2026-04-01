'use client'

import { useData } from '@/components/data-provider'
import { AgentCoach } from '@/components/agent-coach'

export default function CoachPage() {
  const { data } = useData()
  if (!data) return null

  return <AgentCoach data={data} />
}
