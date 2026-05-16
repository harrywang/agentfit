import { NextRequest, NextResponse } from 'next/server'
import { parseSessionDetail } from '@/lib/session-detail'
import { parseCodexSessionDetail } from '@/lib/session-detail-codex'
import { resolveSessionFile } from '@/lib/session-resolver'
import { extractUserMessages, estimateCost } from '@/lib/openai'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sessionIds: string[] = Array.isArray(body.sessionIds)
      ? body.sessionIds
      : body.sessionId
        ? [body.sessionId]
        : []

    if (sessionIds.length === 0) {
      return NextResponse.json({ error: 'Missing sessionId or sessionIds' }, { status: 400 })
    }

    let totalMessages = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCostUSD = 0

    for (const sessionId of sessionIds) {
      const resolved = resolveSessionFile(sessionId)
      if (!resolved) continue

      const detail =
        resolved.source === 'codex'
          ? parseCodexSessionDetail(resolved.filePath, sessionId)
          : parseSessionDetail(resolved.filePath, sessionId)

      const messages = extractUserMessages(detail.chatLog)
      const estimate = estimateCost(messages)

      totalMessages += estimate.messageCount
      totalInputTokens += estimate.estimatedInputTokens
      totalOutputTokens += estimate.estimatedOutputTokens
      totalCostUSD += estimate.estimatedCostUSD
    }

    return NextResponse.json({
      sessionCount: sessionIds.length,
      messageCount: totalMessages,
      estimatedInputTokens: totalInputTokens,
      estimatedOutputTokens: totalOutputTokens,
      estimatedCostUSD: totalCostUSD,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
