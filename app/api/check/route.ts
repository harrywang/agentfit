import { NextResponse } from 'next/server'
import path from 'path'
import os from 'os'
import { checkForNewSessions } from '@/lib/sync'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const newSessions = await checkForNewSessions()
    return NextResponse.json({
      newSessions,
      paths: {
        database: path.resolve(process.cwd(), 'agentfit.db'),
        images: path.resolve(process.cwd(), 'data', 'images'),
        claudeLogs: path.join(os.homedir(), '.claude', 'projects'),
        codexLogs: path.join(os.homedir(), '.codex', 'sessions'),
      },
    })
  } catch (error) {
    return NextResponse.json({ newSessions: 0, error: (error as Error).message }, { status: 500 })
  }
}
