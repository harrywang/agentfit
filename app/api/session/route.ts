import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { parseSessionDetail } from '@/lib/session-detail'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('id')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 })
  }

  try {
    // Search for the JSONL file across all project directories
    const projectsDir = path.join(os.homedir(), '.claude', 'projects')
    let filePath: string | null = null

    if (fs.existsSync(projectsDir)) {
      const dirs = fs.readdirSync(projectsDir)
      for (const dir of dirs) {
        const candidate = path.join(projectsDir, dir, `${sessionId}.jsonl`)
        if (fs.existsSync(candidate)) {
          filePath = candidate
          break
        }
      }
    }

    if (!filePath) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const detail = parseSessionDetail(filePath, sessionId)
    return NextResponse.json(detail)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
