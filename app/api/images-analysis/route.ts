import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const images = await prisma.image.findMany({
      orderBy: { timestamp: 'asc' },
    })
    const sessions = await prisma.session.findMany()
    const sessionMap = new Map(sessions.map((s) => [s.sessionId, s]))

    // --- Basic stats ---
    const totalImages = images.length
    const sessionsWithImages = new Set(images.map((i) => i.sessionId)).size
    const totalSessions = sessions.length
    const byMediaType: Record<string, number> = {}
    let totalBytes = 0
    for (const img of images) {
      byMediaType[img.mediaType] = (byMediaType[img.mediaType] || 0) + 1
      totalBytes += img.sizeBytes
    }

    // --- By project ---
    const byProject: Record<string, number> = {}
    for (const img of images) {
      const session = sessionMap.get(img.sessionId)
      if (session) {
        byProject[session.project] = (byProject[session.project] || 0) + 1
      }
    }

    // --- By hour (user's local timezone approximation via UTC) ---
    const byHour: number[] = new Array(24).fill(0)
    for (const img of images) {
      const h = new Date(img.timestamp).getUTCHours()
      byHour[h]++
    }

    // --- By date ---
    const byDate: Record<string, number> = {}
    for (const img of images) {
      const d = img.timestamp.toISOString().slice(0, 10)
      byDate[d] = (byDate[d] || 0) + 1
    }

    // --- Sessions with vs without images comparison ---
    const withImageSessionIds = new Set(images.map((i) => i.sessionId))
    let withImgStats = { count: 0, messages: 0, cost: 0, duration: 0, tools: 0 }
    let noImgStats = { count: 0, messages: 0, cost: 0, duration: 0, tools: 0 }
    for (const s of sessions) {
      const target = withImageSessionIds.has(s.sessionId) ? withImgStats : noImgStats
      target.count++
      target.messages += s.totalMessages
      target.cost += s.costUSD
      target.duration += s.durationMinutes
      target.tools += s.toolCallsTotal
    }

    // --- Images per session distribution ---
    const imagesPerSession: Record<string, number> = {}
    for (const img of images) {
      imagesPerSession[img.sessionId] = (imagesPerSession[img.sessionId] || 0) + 1
    }
    const countDistribution: Record<number, { sessions: number; avgCost: number; avgMessages: number }> = {}
    for (const [sid, count] of Object.entries(imagesPerSession)) {
      const session = sessionMap.get(sid)
      if (!session) continue
      if (!countDistribution[count]) {
        countDistribution[count] = { sessions: 0, avgCost: 0, avgMessages: 0 }
      }
      countDistribution[count].sessions++
      countDistribution[count].avgCost += session.costUSD
      countDistribution[count].avgMessages += session.totalMessages
    }
    for (const d of Object.values(countDistribution)) {
      d.avgCost /= d.sessions
      d.avgMessages /= d.sessions
    }

    // --- Screenshot frequency (time gaps between images in same session) ---
    const imagesBySession = new Map<string, Date[]>()
    for (const img of images) {
      if (!imagesBySession.has(img.sessionId)) imagesBySession.set(img.sessionId, [])
      imagesBySession.get(img.sessionId)!.push(new Date(img.timestamp))
    }
    const gaps: number[] = []
    for (const timestamps of imagesBySession.values()) {
      timestamps.sort((a, b) => a.getTime() - b.getTime())
      for (let i = 1; i < timestamps.length; i++) {
        const gap = (timestamps[i].getTime() - timestamps[i - 1].getTime()) / 60000
        if (gap > 0) gaps.push(gap)
      }
    }
    gaps.sort((a, b) => a - b)
    const rapidFire = gaps.filter((g) => g < 2).length
    const under5 = gaps.filter((g) => g < 5).length

    // --- Top screenshot-heavy sessions ---
    const topSessions = Object.entries(imagesPerSession)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sid, count]) => {
        const session = sessionMap.get(sid)
        return {
          sessionId: sid,
          imageCount: count,
          project: session?.project || 'unknown',
          messages: session?.totalMessages || 0,
          cost: session?.costUSD || 0,
          date: session?.startTime.toISOString().slice(0, 10) || '',
        }
      })

    // --- All images (newest first, for gallery with pagination) ---
    const allImages = [...images]
      .reverse()
      .map((img) => ({
        filename: img.filename,
        sessionId: img.sessionId,
        timestamp: img.timestamp.toISOString(),
        sizeBytes: img.sizeBytes,
        project: sessionMap.get(img.sessionId)?.project || 'unknown',
      }))

    return NextResponse.json({
      overview: {
        totalImages,
        sessionsWithImages,
        totalSessions,
        percentWithImages: Math.round((sessionsWithImages / totalSessions) * 100),
        totalSizeMB: Math.round(totalBytes / 1024 / 1024),
        avgSizeKB: Math.round(totalBytes / totalImages / 1024),
        byMediaType,
      },
      byProject: Object.entries(byProject)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      byHour: byHour.map((count, hour) => ({ hour, count })),
      byDate: Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date: date.slice(5), count })),
      comparison: {
        withImages: {
          sessions: withImgStats.count,
          avgMessages: Math.round(withImgStats.messages / withImgStats.count),
          avgCost: Number((withImgStats.cost / withImgStats.count).toFixed(2)),
          avgDuration: Math.round(withImgStats.duration / withImgStats.count),
          avgTools: Math.round(withImgStats.tools / withImgStats.count),
        },
        withoutImages: {
          sessions: noImgStats.count,
          avgMessages: Math.round(noImgStats.messages / noImgStats.count),
          avgCost: Number((noImgStats.cost / noImgStats.count).toFixed(2)),
          avgDuration: Math.round(noImgStats.duration / noImgStats.count),
          avgTools: Math.round(noImgStats.tools / noImgStats.count),
        },
      },
      screenshotFrequency: {
        totalGaps: gaps.length,
        medianMinutes: gaps.length ? Number(gaps[Math.floor(gaps.length / 2)].toFixed(1)) : 0,
        meanMinutes: gaps.length ? Number((gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)) : 0,
        rapidFireCount: rapidFire,
        rapidFirePercent: gaps.length ? Math.round((rapidFire / gaps.length) * 100) : 0,
        under5Count: under5,
        under5Percent: gaps.length ? Math.round((under5 / gaps.length) * 100) : 0,
      },
      topSessions,
      allImages,
    })
  } catch (error) {
    console.error('Failed to analyze images:', error)
    return NextResponse.json({ error: 'Failed to analyze images' }, { status: 500 })
  }
}
