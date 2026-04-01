// ─── Command Discovery Insights ──────────────────────────────────────
// Analyzes ~/.claude/history.jsonl command patterns to generate
// actionable coaching insights about command adoption.

import fs from 'fs'
import path from 'path'
import os from 'os'

export interface CommandInsight {
  id: string
  title: string
  description: string
  severity: 'tip' | 'achievement'
  metric?: string
  recommendation?: string
}

interface CommandTimeline {
  command: string
  firstUsed: string  // ISO date
  totalUses: number
  recentUses: number // last 7 days
  isBuiltIn: boolean
}

// High-value built-in commands that many users don't know about
const POWER_COMMANDS: Record<string, { description: string; benefit: string }> = {
  '/compact': {
    description: 'Compress conversation context with optional focus instructions',
    benefit: 'Reduces context overflow by ~50%. Use when context exceeds 80% but you\'re still working on the same task.',
  },
  '/rewind': {
    description: 'Rewind conversation and/or code to a previous point',
    benefit: 'Undo mistakes without restarting. Saves 5-10 minutes per recovery vs starting fresh.',
  },
  '/simplify': {
    description: 'Review changed code for reuse, quality, and efficiency',
    benefit: 'Catches code quality issues automatically. Run after completing a feature to clean up.',
  },
  '/diff': {
    description: 'Interactive diff viewer for uncommitted changes',
    benefit: 'Review all changes at a glance before committing. Catches unintended modifications.',
  },
  '/btw': {
    description: 'Ask a side question without polluting the main conversation',
    benefit: 'Keeps your main context clean. Quick lookups without losing your place.',
  },
  '/branch': {
    description: 'Create a branch of the current conversation',
    benefit: 'Try risky approaches without losing your current progress. Fork, experiment, come back.',
  },
  '/plan': {
    description: 'Enter plan mode for complex tasks',
    benefit: 'Forces the agent to think before acting. Reduces wasted iterations on complex problems.',
  },
  '/context': {
    description: 'Visualize current context usage as a colored grid',
    benefit: 'See exactly what\'s consuming your context window. Know when to /compact.',
  },
  '/security-review': {
    description: 'Analyze pending changes for security vulnerabilities',
    benefit: 'Catches injection, auth, and data exposure issues before they ship.',
  },
  '/insights': {
    description: 'Generate a report analyzing your Claude Code sessions',
    benefit: 'Built-in analytics about your interaction patterns and friction points.',
  },
  '/frontend-design': {
    description: 'Create distinctive, production-grade frontend interfaces',
    benefit: 'Generates polished UI components with creative design choices, not generic AI slop.',
  },
  '/rename': {
    description: 'Name your session for easy recall later',
    benefit: 'Find important sessions quickly with /resume instead of scrolling through UUIDs.',
  },
  '/export': {
    description: 'Export the current conversation as plain text',
    benefit: 'Save important conversations for documentation, sharing, or review.',
  },
}

function parseCommandHistory(): CommandTimeline[] {
  const historyPath = path.join(os.homedir(), '.claude', 'history.jsonl')
  if (!fs.existsSync(historyPath)) return []

  const content = fs.readFileSync(historyPath, 'utf-8')
  const lines = content.trim().split('\n')

  const commandData = new Map<string, { firstUsed: number; uses: number; recentUses: number }>()
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line)
      const text = (entry.display || '').trim()
      const ts = entry.timestamp || 0
      const match = text.match(/^\/([a-zA-Z_-]+)/)
      if (!match) continue
      const cmd = '/' + match[1]

      if (!commandData.has(cmd)) {
        commandData.set(cmd, { firstUsed: ts, uses: 0, recentUses: 0 })
      }
      const d = commandData.get(cmd)!
      d.uses++
      if (d.firstUsed > ts) d.firstUsed = ts
      if (ts > sevenDaysAgo) d.recentUses++
    } catch {
      continue
    }
  }

  return Array.from(commandData.entries()).map(([cmd, data]) => ({
    command: cmd,
    firstUsed: new Date(data.firstUsed).toISOString().slice(0, 10),
    totalUses: data.uses,
    recentUses: data.recentUses,
    isBuiltIn: cmd in POWER_COMMANDS,
  }))
}

export function generateCommandInsights(): CommandInsight[] {
  const timeline = parseCommandHistory()
  const insights: CommandInsight[] = []
  const usedCommands = new Set(timeline.map(t => t.command))

  // 1. Power commands you discovered and now use frequently
  const powerHits = timeline
    .filter(t => POWER_COMMANDS[t.command] && t.totalUses >= 5)
    .sort((a, b) => b.totalUses - a.totalUses)

  if (powerHits.length > 0) {
    const top = powerHits.slice(0, 3)
    insights.push({
      id: 'power-commands-adopted',
      title: `Power commands mastered: ${top.map(t => t.command).join(', ')}`,
      description: `You've adopted ${powerHits.length} power commands. ${top[0].command} is your most-used (${top[0].totalUses}x). These commands significantly improve your workflow efficiency.`,
      severity: 'achievement',
      metric: `${powerHits.length} mastered`,
    })
  }

  // 2. Recently discovered commands gaining traction
  const recentDiscoveries = timeline
    .filter(t => {
      const daysSinceFirst = (Date.now() - new Date(t.firstUsed).getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceFirst < 14 && t.totalUses >= 3
    })
    .sort((a, b) => b.totalUses - a.totalUses)

  for (const disc of recentDiscoveries.slice(0, 2)) {
    const info = POWER_COMMANDS[disc.command]
    insights.push({
      id: `recent-discovery-${disc.command}`,
      title: `New favorite: ${disc.command} (${disc.totalUses}x in ${Math.ceil((Date.now() - new Date(disc.firstUsed).getTime()) / (1000 * 60 * 60 * 24))} days)`,
      description: info
        ? `${info.description}. ${info.benefit}`
        : `You discovered ${disc.command} recently and it's becoming a regular part of your workflow.`,
      severity: 'achievement',
      metric: `${disc.totalUses}x`,
    })
  }

  // 3. High-value commands you haven't tried yet
  const untried = Object.entries(POWER_COMMANDS)
    .filter(([cmd]) => !usedCommands.has(cmd))
    .sort(() => Math.random() - 0.5) // randomize so different tips each time

  for (const [cmd, info] of untried.slice(0, 3)) {
    insights.push({
      id: `try-${cmd}`,
      title: `Try ${cmd}`,
      description: info.description,
      severity: 'tip',
      recommendation: info.benefit,
    })
  }

  // 4. Commands you used to use but stopped
  const abandoned = timeline
    .filter(t => t.totalUses >= 3 && t.recentUses === 0 && POWER_COMMANDS[t.command])
    .sort((a, b) => b.totalUses - a.totalUses)

  for (const cmd of abandoned.slice(0, 2)) {
    const info = POWER_COMMANDS[cmd.command]!
    insights.push({
      id: `revive-${cmd.command}`,
      title: `Revisit ${cmd.command}?`,
      description: `You used ${cmd.command} ${cmd.totalUses} times but haven't used it recently.`,
      severity: 'tip',
      recommendation: info.benefit,
    })
  }

  // 5. Command diversity insight
  const weeklyDiversity = timeline.filter(t => t.recentUses > 0).length
  if (weeklyDiversity >= 8) {
    insights.push({
      id: 'diverse-commands',
      title: `${weeklyDiversity} commands used this week`,
      description: 'You have a diverse command vocabulary. This means you\'re leveraging the full power of your coding agent instead of just chatting.',
      severity: 'achievement',
      metric: `${weeklyDiversity} active`,
    })
  } else if (weeklyDiversity <= 3 && timeline.length > 5) {
    insights.push({
      id: 'low-diversity',
      title: 'Low command diversity this week',
      description: `Only ${weeklyDiversity} commands used in the last 7 days. Slash commands save time by encoding common workflows into single keystrokes.`,
      severity: 'tip',
      recommendation: 'Type / in Claude Code to see all available commands. Try using at least one new command today.',
    })
  }

  // 6. Custom skills/plugins adoption
  const customCommands = timeline.filter(t => !Object.keys(POWER_COMMANDS).includes(t.command) && t.totalUses >= 3)
  if (customCommands.length >= 3) {
    const topCustom = customCommands.sort((a, b) => b.totalUses - a.totalUses).slice(0, 3)
    insights.push({
      id: 'custom-skills',
      title: `${customCommands.length} custom skills in your toolkit`,
      description: `Your most-used custom commands: ${topCustom.map(c => `${c.command} (${c.totalUses}x)`).join(', ')}. Custom skills automate your specific workflows.`,
      severity: 'achievement',
      metric: `${customCommands.length} skills`,
    })
  }

  return insights
}
