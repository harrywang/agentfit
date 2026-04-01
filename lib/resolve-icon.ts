import * as icons from 'lucide-react'
import { Puzzle } from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * Resolve a lucide-react icon by name string.
 * Falls back to the Puzzle icon if the name is not found.
 */
export function resolveLucideIcon(name: string): ComponentType<{ className?: string }> {
  const Icon = (icons as unknown as Record<string, ComponentType<{ className?: string }>>)[name]
  return Icon || Puzzle
}
