import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { getOpenAIKey } from '@/lib/config'
import { parseSessionDetail } from '@/lib/session-detail'
import { extractUserMessages, classifyMessages } from '@/lib/openai'

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

// GET — retrieve analysis results
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  const status = request.nextUrl.searchParams.get('status')

  try {
    if (status === 'true') {
      // Return all analyzed session IDs
      const analyses = await prisma.sessionAnalysis.findMany({
        select: { sessionId: true, analyzedAt: true, totalMessages: true, costUSD: true },
      })
      return NextResponse.json({ analyses })
    }

    if (sessionId) {
      const analysis = await prisma.sessionAnalysis.findUnique({
        where: { sessionId },
      })
      if (!analysis) {
        return NextResponse.json({ analysis: null })
      }
      return NextResponse.json({
        analysis: {
          ...analysis,
          classifications: JSON.parse(analysis.classifications),
        },
      })
    }

    return NextResponse.json({ error: 'Missing sessionId or status param' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// POST — trigger analysis for a session
export async function POST(request: NextRequest) {
  const apiKey = getOpenAIKey()
  if (!apiKey) {
    return NextResponse.json({ error: 'No OpenAI API key configured. Go to Settings to add one.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const sessionId = body.sessionId as string
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    // Check if already analyzed
    const existing = await prisma.sessionAnalysis.findUnique({
      where: { sessionId },
    })
    if (existing && !body.force) {
      return NextResponse.json({
        analysis: {
          ...existing,
          classifications: JSON.parse(existing.classifications),
        },
        cached: true,
      })
    }

    // Find and parse the session
    const filePath = findSessionFile(sessionId)
    if (!filePath) {
      return NextResponse.json({ error: 'Session JSONL not found' }, { status: 404 })
    }

    const detail = parseSessionDetail(filePath, sessionId)
    const messages = extractUserMessages(detail.chatLog)

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No user messages to analyze' }, { status: 400 })
    }

    // Classify
    const result = await classifyMessages(apiKey, messages)

    // Store results (upsert in case of re-analysis)
    const analysis = await prisma.sessionAnalysis.upsert({
      where: { sessionId },
      create: {
        sessionId,
        model: result.model,
        classifications: JSON.stringify(result.classifications),
        totalMessages: result.totalMessages,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUSD: result.costUSD,
      },
      update: {
        model: result.model,
        classifications: JSON.stringify(result.classifications),
        totalMessages: result.totalMessages,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUSD: result.costUSD,
        analyzedAt: new Date(),
      },
    })

    return NextResponse.json({
      analysis: {
        ...analysis,
        classifications: result.classifications,
      },
      cached: false,
    })
  } catch (error) {
    const message = (error as Error).message
    // Surface OpenAI-specific errors clearly
    if (message.includes('401') || message.includes('Incorrect API key')) {
      return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 401 })
    }
    if (message.includes('429')) {
      return NextResponse.json({ error: 'OpenAI rate limit exceeded. Try again later.' }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
