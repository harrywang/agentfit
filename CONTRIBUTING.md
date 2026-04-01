# Contributing a Community Plugin

AgentFit has a plugin system that lets anyone contribute new analysis views. Your plugin appears in the **Community** sidebar section and receives the same usage data as built-in pages.

## Quick Start

```bash
# 1. Fork & clone
git clone https://github.com/<you>/agentfit && cd agentfit
npm install

# 2. Scaffold your plugin
mkdir -p plugins/my-analysis

# 3. Create the two required files (see below)
# 4. Register it in plugins/index.ts
# 5. Run dev server & tests
npm run dev
npm test
```

## Plugin Structure

Every plugin lives in its own folder under `plugins/` and has exactly **two files** plus a test:

```
plugins/
  my-analysis/
    manifest.ts          # metadata (name, slug, icon, etc.)
    component.tsx        # React component that renders the analysis
    component.test.tsx   # tests (required for PR acceptance)
```

### manifest.ts

```ts
import type { PluginManifest } from '@/lib/plugins'

const manifest: PluginManifest = {
  slug: 'my-analysis',          // URL-safe, lowercase, hyphens only
  name: 'My Analysis',          // shown in sidebar
  description: 'One-line summary of what this shows',
  author: 'your-github-handle',
  icon: 'ChartArea',            // any lucide-react icon name
  version: '1.0.0',
  tags: ['cost', 'productivity'],  // optional, for discoverability
}

export default manifest
```

**Slug rules:** lowercase letters, numbers, hyphens only (e.g. `my-analysis`). Must be unique across all plugins.

### component.tsx

```tsx
'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PluginProps } from '@/lib/plugins'

export default function MyAnalysis({ data }: PluginProps) {
  const stats = useMemo(() => {
    // Compute your analysis from data.sessions, data.daily, etc.
    return { total: data.sessions.length }
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Found {stats.total} sessions</p>
      </CardContent>
    </Card>
  )
}
```

### Registration

Open `plugins/index.ts` and add your import + registration call:

```ts
// ─── Community plugins ──────────────────────────────────────────────
import myAnalysisManifest from './my-analysis/manifest'
import MyAnalysis from './my-analysis/component'
registerPlugin(myAnalysisManifest, MyAnalysis)
```

That's it. Your plugin now appears in the sidebar at `/community/my-analysis`.

## Data Available to Plugins

Your component receives `PluginProps`:

```ts
interface PluginProps {
  data: UsageData
}
```

`UsageData` contains:

| Field | Type | Description |
|-------|------|-------------|
| `overview` | `OverviewStats` | Aggregated metrics (totals for sessions, tokens, cost, etc.) |
| `sessions` | `SessionSummary[]` | Every session with tokens, cost, duration, tool calls |
| `projects` | `ProjectSummary[]` | Per-project aggregations |
| `daily` | `DailyUsage[]` | Per-day aggregations |
| `toolUsage` | `Record<string, number>` | Tool invocation counts |

All data is already filtered by the user's selected time range and agent type. You don't need to filter again.

See `lib/parse-logs.ts` for the full type definitions.

## UI Guidelines

- Use **shadcn UI** components from `components/ui/` (Card, Badge, Table, etc.)
- Use **Recharts** (already installed) for charts, wrapped in `ChartContainer`
- Use `lib/format.ts` helpers: `formatCost()`, `formatTokens()`, `formatDuration()`
- Use the existing CSS chart color variables: `--chart-1` through `--chart-10`
- Mark your component as `'use client'` at the top
- Wrap computed values in `useMemo` for performance

## Writing Tests

Every plugin must include tests. Use the provided test helpers:

```tsx
// plugins/my-analysis/component.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderPlugin } from '@/tests/plugin-helpers'
import { validateManifest } from '@/lib/plugins'
import MyAnalysis from './component'
import manifest from './manifest'

describe('my-analysis plugin', () => {
  it('manifest passes validation', () => {
    expect(validateManifest(manifest)).toEqual([])
  })

  it('renders without crashing', () => {
    const { container } = renderPlugin(MyAnalysis)
    expect(container).toBeTruthy()
  })

  it('shows expected content', () => {
    renderPlugin(MyAnalysis)
    expect(screen.getByText('My Analysis')).toBeInTheDocument()
  })

  it('handles empty data', () => {
    renderPlugin(MyAnalysis, { sessions: [], daily: [], projects: [] })
    // Should not crash — show an empty state instead
  })
})
```

### Test utilities

| Helper | Import | Description |
|--------|--------|-------------|
| `renderPlugin(Component, dataOverrides?)` | `@/tests/plugin-helpers` | Renders your plugin with mock `UsageData` |
| `createMockData(overrides?)` | `@/tests/fixtures` | Creates a realistic `UsageData` object |
| `createMockSession(overrides?)` | `@/tests/fixtures` | Creates a single `SessionSummary` |
| `createMockDaily(overrides?)` | `@/tests/fixtures` | Creates a single `DailyUsage` |
| `validateManifest(manifest)` | `@/lib/plugins` | Returns array of validation errors (empty = valid) |

### Running tests

```bash
npm test                 # run all tests once
npm run test:watch       # watch mode during development
```

## PR Checklist

Before submitting your pull request:

- [ ] Plugin folder is in `plugins/<your-slug>/`
- [ ] `manifest.ts` passes `validateManifest()` with zero errors
- [ ] `component.tsx` exports a default React component accepting `PluginProps`
- [ ] Plugin is registered in `plugins/index.ts`
- [ ] Tests exist in `component.test.tsx` and all pass (`npm test`)
- [ ] Component handles empty data gracefully (no crashes)
- [ ] No new dependencies added (use existing recharts, shadcn, lucide-react)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Advanced: Custom Data Sources

If your plugin fetches its own data (e.g., from a custom API route), set `customDataSource: true` in your manifest. This hides the time-range filter when your plugin is active.

```ts
const manifest: PluginManifest = {
  // ...
  customDataSource: true,
}
```

You can still use the `data` prop as a fallback, but you're free to `fetch()` additional data in a `useEffect`.

## Example Plugin

See `plugins/cost-heatmap/` for a complete working example with manifest, component, and tests.
