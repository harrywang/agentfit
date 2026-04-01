'use client'

import { useData } from '@/components/data-provider'
import { TokenBreakdown } from '@/components/token-breakdown'

export default function TokensPage() {
  const { data } = useData()
  if (!data) return null

  return <TokenBreakdown daily={data.daily} overview={data.overview} />
}
