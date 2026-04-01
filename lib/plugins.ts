import type { ComponentType } from 'react'
import type { UsageData } from './parse-logs'

// ─── Plugin Contract ────────────────────────────────────────────────
// Every community plugin must export a manifest and a default component
// that conforms to these interfaces.

/** Props passed to every community plugin component */
export interface PluginProps {
  data: UsageData
}

/** Metadata every plugin must declare in its manifest.ts */
export interface PluginManifest {
  /** Unique URL-safe slug (lowercase, hyphens only). Used as the route segment. */
  slug: string
  /** Human-readable name shown in the sidebar */
  name: string
  /** One-line description shown in tooltips */
  description: string
  /** Author name or GitHub handle */
  author: string
  /** Lucide icon name (e.g. "Flame"). Resolved at render time. */
  icon: string
  /** Semver version string */
  version: string
  /** Optional tags for discoverability */
  tags?: string[]
  /** Set to true if the plugin fetches its own data (hides time-range filter) */
  customDataSource?: boolean
}

/** A fully resolved plugin ready to render */
export interface ResolvedPlugin {
  manifest: PluginManifest
  component: ComponentType<PluginProps>
}

// ─── Plugin Registry ────────────────────────────────────────────────
// Plugins register themselves by calling registerPlugin().
// The registry is populated at import time via plugins/index.ts.

const registry = new Map<string, ResolvedPlugin>()

/** Register a community plugin. Called from plugins/index.ts. */
export function registerPlugin(
  manifest: PluginManifest,
  component: ComponentType<PluginProps>,
) {
  if (registry.has(manifest.slug)) {
    console.warn(`[AgentFit] Duplicate plugin slug: "${manifest.slug}" — skipping.`)
    return
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.slug)) {
    console.warn(
      `[AgentFit] Invalid plugin slug: "${manifest.slug}". ` +
        'Use lowercase letters, numbers, and hyphens only.',
    )
    return
  }
  registry.set(manifest.slug, { manifest, component })
}

/** Get all registered plugins (sorted alphabetically by name) */
export function getPlugins(): ResolvedPlugin[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.manifest.name.localeCompare(b.manifest.name),
  )
}

/** Look up a single plugin by slug */
export function getPlugin(slug: string): ResolvedPlugin | undefined {
  return registry.get(slug)
}

// ─── Validation helper (used by tests) ──────────────────────────────

export function validateManifest(m: unknown): string[] {
  const errors: string[] = []
  if (!m || typeof m !== 'object') {
    return ['Manifest must be an object']
  }
  const obj = m as Record<string, unknown>

  const requiredStrings = ['slug', 'name', 'description', 'author', 'icon', 'version'] as const
  for (const key of requiredStrings) {
    if (typeof obj[key] !== 'string' || (obj[key] as string).trim() === '') {
      errors.push(`"${key}" must be a non-empty string`)
    }
  }

  if (typeof obj.slug === 'string' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(obj.slug)) {
    errors.push('"slug" must be lowercase alphanumeric with hyphens (e.g. "my-plugin")')
  }

  if (typeof obj.version === 'string' && !/^\d+\.\d+\.\d+/.test(obj.version)) {
    errors.push('"version" must follow semver (e.g. "1.0.0")')
  }

  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags) || !obj.tags.every((t: unknown) => typeof t === 'string')) {
      errors.push('"tags" must be an array of strings')
    }
  }

  return errors
}
