import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIKey, setOpenAIKey, clearOpenAIKey } from '@/lib/config'

export const dynamic = 'force-dynamic'

// GET — check if API key is configured (returns masked key, not the actual key)
export async function GET() {
  const key = getOpenAIKey()
  return NextResponse.json({
    hasOpenAIKey: !!key,
    maskedKey: key ? `${key.slice(0, 7)}...${key.slice(-4)}` : null,
  })
}

// POST — save or clear the API key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'clear') {
      clearOpenAIKey()
      return NextResponse.json({ success: true })
    }

    const apiKey = body.apiKey as string
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 })
    }

    setOpenAIKey(apiKey.trim())
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
