import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderPlugin } from '@/tests/plugin-helpers'
import { validateManifest } from '@/lib/plugins'
import CostHeatmap from './component'
import manifest from './manifest'

describe('cost-heatmap plugin', () => {
  describe('manifest', () => {
    it('passes validation', () => {
      const errors = validateManifest(manifest)
      expect(errors).toEqual([])
    })

    it('has required fields', () => {
      expect(manifest.slug).toBe('cost-heatmap')
      expect(manifest.name).toBe('Cost Heatmap')
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('component', () => {
    it('renders without crashing', () => {
      const { container } = renderPlugin(CostHeatmap)
      expect(container).toBeTruthy()
    })

    it('displays stats cards', () => {
      renderPlugin(CostHeatmap)
      expect(screen.getByText('Total Spend')).toBeInTheDocument()
      expect(screen.getByText('Active Days')).toBeInTheDocument()
      expect(screen.getByText('Peak Day')).toBeInTheDocument()
      expect(screen.getByText('Peak Cost')).toBeInTheDocument()
    })

    it('displays the heatmap card', () => {
      renderPlugin(CostHeatmap)
      expect(screen.getByText('Daily Cost Heatmap')).toBeInTheDocument()
    })

    it('shows empty state when no data', () => {
      renderPlugin(CostHeatmap, { daily: [] })
      expect(screen.getByText('No data available yet.')).toBeInTheDocument()
    })

    it('renders legend', () => {
      renderPlugin(CostHeatmap)
      expect(screen.getByText('Less')).toBeInTheDocument()
      expect(screen.getByText('More')).toBeInTheDocument()
    })
  })
})
