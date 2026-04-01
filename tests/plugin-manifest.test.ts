import { describe, it, expect } from 'vitest'
import { validateManifest } from '@/lib/plugins'

describe('validateManifest', () => {
  const validManifest = {
    slug: 'my-plugin',
    name: 'My Plugin',
    description: 'A test plugin',
    author: 'Test Author',
    icon: 'Flame',
    version: '1.0.0',
  }

  it('accepts a valid manifest', () => {
    expect(validateManifest(validManifest)).toEqual([])
  })

  it('accepts optional tags', () => {
    expect(validateManifest({ ...validManifest, tags: ['cost', 'chart'] })).toEqual([])
  })

  it('rejects non-object input', () => {
    expect(validateManifest(null)).toEqual(['Manifest must be an object'])
    expect(validateManifest('string')).toEqual(['Manifest must be an object'])
  })

  it('rejects missing required fields', () => {
    const errors = validateManifest({})
    expect(errors).toContain('"slug" must be a non-empty string')
    expect(errors).toContain('"name" must be a non-empty string')
    expect(errors).toContain('"version" must be a non-empty string')
  })

  it('rejects invalid slug format', () => {
    const errors = validateManifest({ ...validManifest, slug: 'My Plugin!' })
    expect(errors).toContain('"slug" must be lowercase alphanumeric with hyphens (e.g. "my-plugin")')
  })

  it('rejects invalid version format', () => {
    const errors = validateManifest({ ...validManifest, version: 'v1' })
    expect(errors).toContain('"version" must follow semver (e.g. "1.0.0")')
  })

  it('rejects non-array tags', () => {
    const errors = validateManifest({ ...validManifest, tags: 'not-array' })
    expect(errors).toContain('"tags" must be an array of strings')
  })
})
