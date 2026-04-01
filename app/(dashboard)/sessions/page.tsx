'use client'

import { useData } from '@/components/data-provider'
import { SessionsTable } from '@/components/sessions-table'

export default function SessionsPage() {
  const { data } = useData()
  if (!data) return null

  return <SessionsTable sessions={data.sessions} />
}
