import { NextResponse } from 'next/server'
import { analyzeCommands } from '@/lib/commands'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const analysis = analyzeCommands()

    // Merge skill invocations from session data (Skill tool calls tracked in DB)
    // These capture cases where the user asked Claude to invoke a skill
    // (e.g. "use /doc-writer to...") rather than typing the slash command directly
    const dbSessions = await prisma.session.findMany({
      select: { skillCallsJson: true },
    })

    const dbSkillCounts = new Map<string, number>()
    for (const s of dbSessions) {
      const skills = JSON.parse(s.skillCallsJson) as Record<string, number>
      for (const [skill, count] of Object.entries(skills)) {
        const cmd = skill.startsWith('/') ? skill : `/${skill}`
        dbSkillCounts.set(cmd, (dbSkillCounts.get(cmd) || 0) + count)
      }
    }

    // Build a map of history.jsonl counts for custom commands
    const historyMap = new Map<string, number>()
    for (const c of analysis.customCommands) {
      historyMap.set(c.command, c.count)
    }

    // Merge DB skill counts into customCommands with breakdown
    const customMap = new Map<string, { command: string; count: number; historyCount: number; sessionCount: number }>()
    for (const c of analysis.customCommands) {
      customMap.set(c.command, { command: c.command, count: c.count, historyCount: c.count, sessionCount: 0 })
    }
    for (const [cmd, count] of dbSkillCounts) {
      const existing = analysis.commands.find(c => c.command === cmd)
      if (existing) {
        existing.count += count
        existing.used = existing.count > 0
      } else {
        const prev = customMap.get(cmd)
        if (prev) {
          prev.sessionCount += count
          prev.count += count
        } else {
          customMap.set(cmd, { command: cmd, count, historyCount: 0, sessionCount: count })
        }
      }
    }

    analysis.customCommands = Array.from(customMap.values())
      .sort((a, b) => b.count - a.count)

    // Expose session skill counts so the chart can show breakdown
    const responseData = {
      ...analysis,
      dbSkillCounts: Object.fromEntries(dbSkillCounts),
    }

    return NextResponse.json(responseData)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
