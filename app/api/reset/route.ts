import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncLogs } from '@/lib/sync'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Delete all records in order (images reference sessions)
    await prisma.image.deleteMany()
    await prisma.session.deleteMany()
    await prisma.syncLog.deleteMany()

    // Re-sync from disk
    const result = await syncLogs()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Reset failed:', error)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
