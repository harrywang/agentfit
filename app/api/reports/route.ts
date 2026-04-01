import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateReport } from '@/lib/report'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { generatedAt: 'desc' },
      select: { id: true, title: true, generatedAt: true, sessionCount: true },
    })
    return NextResponse.json(reports)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const { title, contentJson, sessionCount } = await generateReport()

    // Check if data has changed since last report
    const lastReport = await prisma.report.findFirst({
      orderBy: { generatedAt: 'desc' },
      select: { sessionCount: true },
    })

    if (lastReport && lastReport.sessionCount === sessionCount) {
      return NextResponse.json(
        { error: 'No new data since the last report. Sync new sessions first.' },
        { status: 409 }
      )
    }

    const report = await prisma.report.create({
      data: {
        title,
        contentJson: JSON.stringify(contentJson),
        sessionCount,
      },
    })
    return NextResponse.json({
      ...report,
      contentJson: JSON.parse(report.contentJson),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
