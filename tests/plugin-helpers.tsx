/**
 * Test helpers for community plugin development.
 *
 * Usage:
 *   import { renderPlugin } from '@/tests/plugin-helpers'
 *   import MyPlugin from '../plugins/my-plugin/component'
 *
 *   test('renders without crashing', () => {
 *     const { container } = renderPlugin(MyPlugin)
 *     expect(container).toBeTruthy()
 *   })
 */
import { render, type RenderOptions } from '@testing-library/react'
import type { ComponentType, ReactElement } from 'react'
import type { PluginProps } from '@/lib/plugins'
import type { UsageData } from '@/lib/parse-logs'
import { createMockData } from './fixtures'

/** Render a plugin component with mock data */
export function renderPlugin(
  Component: ComponentType<PluginProps>,
  dataOverrides?: Partial<UsageData>,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const data = createMockData(dataOverrides)
  return {
    ...render(<Component data={data} /> as ReactElement, options),
    data,
  }
}
