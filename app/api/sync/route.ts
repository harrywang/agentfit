import { NextResponse } from 'next/server'
import { syncLogs } from '@/lib/sync'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = await syncLogs()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Sync failed:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
