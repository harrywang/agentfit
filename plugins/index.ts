/**
 * Plugin registration entrypoint.
 *
 * Community contributors: import your plugin's manifest and component here,
 * then call registerPlugin(). See CONTRIBUTING.md for the full guide.
 */
import { registerPlugin } from '@/lib/plugins'

// ─── Built-in example ───────────────────────────────────────────────
import costHeatmapManifest from './cost-heatmap/manifest'
import CostHeatmap from './cost-heatmap/component'

registerPlugin(costHeatmapManifest, CostHeatmap)

// ─── Community plugins (add yours below this line) ──────────────────
// import myManifest from './my-plugin/manifest'
// import MyComponent from './my-plugin/component'
// registerPlugin(myManifest, MyComponent)
