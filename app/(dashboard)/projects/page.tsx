'use client'

import { useData } from '@/components/data-provider'
import { ProjectsTable } from '@/components/projects-table'

export default function ProjectsPage() {
  const { data } = useData()
  if (!data) return null

  return <ProjectsTable projects={data.projects} />
}
