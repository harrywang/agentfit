'use client'

import { useData } from '@/components/data-provider'
import { PersonalityFit } from '@/components/personality-fit'

export default function PersonalityPage() {
  const { data } = useData()
  if (!data) return null

  return <PersonalityFit data={data} />
}
