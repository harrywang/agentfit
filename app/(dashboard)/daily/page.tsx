'use client'

import { useData } from '@/components/data-provider'
import { DailyChart } from '@/components/daily-chart'
import { DailyTable } from '@/components/daily-table'

export default function DailyPage() {
  const { data } = useData()
  if (!data) return null

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <DailyChart daily={data.daily} sessions={data.sessions} />
      </div>
      <DailyTable daily={data.daily} sessions={data.sessions} />
    </>
  )
}
