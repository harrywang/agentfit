import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { parseSessionDetail } from '@/lib/session-detail'
import { extractUserMessages, estimateCost } from '@/lib/openai'

export const dynamic = 'force-dynamic'

function findSessionFile(sessionId: string): string | null {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(projectsDir)) return null
  for (const dir of fs.readdirSync(projectsDir)) {
    const candidate = path.join(projectsDir, dir, `${sessionId}.jsonl`)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

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
      const filePath = findSessionFile(sessionId)
      if (!filePath) continue

      const detail = parseSessionDetail(filePath, sessionId)
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
