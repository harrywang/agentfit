import { NextRequest, NextResponse } from 'next/server'
import { parseSessionDetail } from '@/lib/session-detail'
import { parseCodexSessionDetail } from '@/lib/session-detail-codex'
import { resolveSessionFile } from '@/lib/session-resolver'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('id')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 })
  }

  try {
    const resolved = resolveSessionFile(sessionId)
    if (!resolved) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const detail =
      resolved.source === 'codex'
        ? parseCodexSessionDetail(resolved.filePath, sessionId)
        : parseSessionDetail(resolved.filePath, sessionId)

    return NextResponse.json(detail)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
