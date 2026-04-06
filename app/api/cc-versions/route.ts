import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const NPM_URL = 'https://registry.npmjs.org/@anthropic-ai/claude-code'
const CACHE_FILE = path.resolve(process.cwd(), 'data', 'cc-versions.json')
const CACHE_TTL = 86_400_000 // 24 hours

interface VersionCache {
  versions: Record<string, string>
  fetchedAt: number
}

let memCache: VersionCache | null = null

function readDiskCache(): VersionCache | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    }
  } catch {}
  return null
}

function writeDiskCache(cache: VersionCache) {
  try {
    const dir = path.dirname(CACHE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
  } catch {}
}

function isFresh(cache: VersionCache | null): boolean {
  return !!cache && Date.now() - cache.fetchedAt < CACHE_TTL
}

export async function GET() {
  try {
    // 1. Check in-memory cache
    if (isFresh(memCache)) {
      return NextResponse.json(memCache!.versions)
    }

    // 2. Check disk cache (survives server restarts)
    const disk = readDiskCache()
    if (isFresh(disk)) {
      memCache = disk
      return NextResponse.json(disk!.versions)
    }

    // 3. Fetch from npm registry
    const res = await fetch(NPM_URL, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      // Fall back to stale cache if available
      if (memCache) return NextResponse.json(memCache.versions)
      if (disk) return NextResponse.json(disk.versions)
      throw new Error(`npm registry returned ${res.status}`)
    }

    const pkg = await res.json()
    const time: Record<string, string> = pkg.time || {}

    // Filter to only version entries (exclude "created", "modified")
    const versions: Record<string, string> = {}
    for (const [key, value] of Object.entries(time)) {
      if (/^\d+\.\d+\.\d+$/.test(key)) {
        versions[key] = value as string
      }
    }

    const cache: VersionCache = { versions, fetchedAt: Date.now() }
    memCache = cache
    writeDiskCache(cache)

    return NextResponse.json(versions)
  } catch (error) {
    console.error('Failed to fetch CC versions:', error)
    return NextResponse.json({}, { status: 500 })
  }
}
