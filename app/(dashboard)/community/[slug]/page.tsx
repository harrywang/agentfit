'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useData } from '@/components/data-provider'
import { getPlugin } from '@/lib/plugins'
import '@/plugins' // ensure plugins are registered

export default function CommunityPluginPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const { data } = useData()
  const plugin = getPlugin(slug)

  if (!plugin) notFound()
  if (!data) return null

  const Component = plugin.component
  return <Component data={data} />
}
