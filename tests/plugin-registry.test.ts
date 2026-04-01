import { describe, it, expect, beforeEach } from 'vitest'

// We test the registry by importing the module fresh.
// Since registerPlugin/getPlugins use a module-level Map, we test the public API.

describe('plugin registry', () => {
  it('registers and retrieves the cost-heatmap plugin', async () => {
    // Import plugins to trigger registration
    await import('@/plugins')
    const { getPlugin, getPlugins } = await import('@/lib/plugins')

    const plugins = getPlugins()
    expect(plugins.length).toBeGreaterThanOrEqual(1)

    const costHeatmap = getPlugin('cost-heatmap')
    expect(costHeatmap).toBeDefined()
    expect(costHeatmap!.manifest.name).toBe('Cost Heatmap')
    expect(costHeatmap!.manifest.author).toBe('AgentFit Team')
    expect(costHeatmap!.component).toBeDefined()
  })
})
