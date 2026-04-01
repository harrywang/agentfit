import { NextResponse } from 'next/server'
import { generateCommandInsights } from '@/lib/command-insights'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const insights = generateCommandInsights()
    return NextResponse.json(insights)
  } catch (error) {
    return NextResponse.json([], { status: 500 })
  }
}
