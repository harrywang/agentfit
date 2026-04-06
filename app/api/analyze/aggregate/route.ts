import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { MessageClassification } from '@/lib/openai'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project')

  try {
    // Get all analyses, optionally filtered by project
    let sessionIds: string[] | undefined

    if (project) {
      const sessions = await prisma.session.findMany({
        where: { project },
        select: { sessionId: true },
      })
      sessionIds = sessions.map((s) => s.sessionId)
    }

    const analyses = await prisma.sessionAnalysis.findMany({
      where: sessionIds ? { sessionId: { in: sessionIds } } : undefined,
    })

    if (analyses.length === 0) {
      return NextResponse.json({ aggregate: null, analyzedCount: 0 })
    }

    // Aggregate all classifications
    const allClassifications: MessageClassification[] = []
    let totalCostUSD = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const a of analyses) {
      const cls = JSON.parse(a.classifications) as MessageClassification[]
      allClassifications.push(...cls)
      totalCostUSD += a.costUSD
      totalInputTokens += a.inputTokens
      totalOutputTokens += a.outputTokens
    }

    // Build distributions
    const messageTypes: Record<string, number> = {}
    const roles: Record<string, number> = {}
    const skillLevels: Record<string, number> = {}
    const sentiments: Record<string, number> = {}

    for (const cls of allClassifications) {
      messageTypes[cls.messageType] = (messageTypes[cls.messageType] || 0) + 1
      roles[cls.role] = (roles[cls.role] || 0) + 1
      skillLevels[cls.skillLevel] = (skillLevels[cls.skillLevel] || 0) + 1
      sentiments[cls.sentiment] = (sentiments[cls.sentiment] || 0) + 1
    }

    // Cross-tabulations
    const roleByType: Record<string, Record<string, number>> = {}
    const roleBySentiment: Record<string, Record<string, number>> = {}

    for (const cls of allClassifications) {
      if (!roleByType[cls.role]) roleByType[cls.role] = {}
      roleByType[cls.role][cls.messageType] = (roleByType[cls.role][cls.messageType] || 0) + 1

      if (!roleBySentiment[cls.role]) roleBySentiment[cls.role] = {}
      roleBySentiment[cls.role][cls.sentiment] =
        (roleBySentiment[cls.role][cls.sentiment] || 0) + 1
    }

    return NextResponse.json({
      aggregate: {
        totalMessages: allClassifications.length,
        messageTypes,
        roles,
        skillLevels,
        sentiments,
        roleByType,
        roleBySentiment,
      },
      analyzedCount: analyses.length,
      totalCostUSD,
      totalInputTokens,
      totalOutputTokens,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
