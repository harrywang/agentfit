// ─── CRAFT Coach ─────────────────────────────────────────────────────
// Analyzes usage data and generates actionable coaching insights,
// like a Garmin coach for your AI coding agent.
// Priority: behavioral improvement > workflow efficiency > cost (secondary)

import type { UsageData, SessionSummary } from './parse-logs'

export type InsightSeverity = 'tip' | 'warning' | 'achievement'
export type CraftDimension = 'context' | 'reach' | 'autonomy' | 'flow' | 'throughput'
export type InsightCategory =
  | 'cost'
  | 'efficiency'
  | 'tools'
  | 'context'
  | 'model'
  | 'habits'
  | 'discovery'
  | 'streak'

export interface CoachInsight {
  id: string
  title: string
  description: string
  category: InsightCategory
  severity: InsightSeverity
  metric?: string
  recommendation?: string
  craft?: CraftDimension
}

export interface CraftScores {
  context: number
  reach: number
  autonomy: number
  flow: number
  throughput: number
}

export interface CoachSummary {
  score: number
  scoreLabel: string
  craft: CraftScores
  insights: CoachInsight[]
  stats: {
    avgCostPerSession: number
    avgDurationMinutes: number
    avgMessagesPerSession: number
    avgToolCallsPerSession: number
    mostUsedModel: string
    mostActiveDay: string
    longestStreak: number
    currentStreak: number
    totalDays: number
    peakHour: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function calculateStreaks(sessions: SessionSummary[]): { longest: number; current: number } {
  const dates = new Set(sessions.map(s => s.startTime.slice(0, 10)))
  const sorted = Array.from(dates).sort()
  if (sorted.length === 0) return { longest: 0, current: 0 }

  let longest = 1, streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
    if (diff === 1) { streak++; longest = Math.max(longest, streak) }
    else streak = 1
  }

  const lastDate = new Date(sorted[sorted.length - 1])
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diffFromToday = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  const current = diffFromToday <= 1 ? streak : 0
  return { longest, current }
}

function findPeakHour(sessions: SessionSummary[]): number {
  const hourCounts = new Array(24).fill(0)
  for (const s of sessions) { if (s.startTime) hourCounts[new Date(s.startTime).getHours()]++ }
  return hourCounts.indexOf(Math.max(...hourCounts))
}

function findMostActiveDay(sessions: SessionSummary[]): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayCounts = new Array(7).fill(0)
  for (const s of sessions) { if (s.startTime) dayCounts[new Date(s.startTime).getDay()]++ }
  return days[dayCounts.indexOf(Math.max(...dayCounts))]
}

// ─── Insight Generation ──────────────────────────────────────────────

export function generateCoachInsights(data: UsageData): CoachSummary {
  const { sessions, overview, toolUsage } = data
  const insights: CoachInsight[] = []

  if (sessions.length === 0) {
    return {
      score: 0, scoreLabel: 'No data',
      craft: { context: 0, reach: 0, autonomy: 0, flow: 0, throughput: 0 },
      insights: [{ id: 'no-data', title: 'No sessions found', description: 'Start using your coding agent to get coaching insights.', category: 'habits', severity: 'tip' }],
      stats: { avgCostPerSession: 0, avgDurationMinutes: 0, avgMessagesPerSession: 0, avgToolCallsPerSession: 0, mostUsedModel: 'N/A', mostActiveDay: 'N/A', longestStreak: 0, currentStreak: 0, totalDays: 0, peakHour: 0 },
    }
  }

  const avgCost = overview.totalCostUSD / sessions.length
  const avgDuration = overview.totalDurationMinutes / sessions.length
  const avgMessages = overview.totalMessages / sessions.length
  const avgToolCalls = overview.totalToolCalls / sessions.length
  const modelEntries = Object.entries(overview.models).sort((a, b) => b[1] - a[1])
  const mostUsedModel = modelEntries[0]?.[0] || 'unknown'
  const streaks = calculateStreaks(sessions)
  const peakHour = findPeakHour(sessions)
  const mostActiveDay = findMostActiveDay(sessions)
  const uniqueDates = new Set(sessions.map(s => s.startTime.slice(0, 10)))
  const totalToolCalls = overview.totalToolCalls

  const sortedByDate = [...sessions].sort((a, b) => b.startTime.localeCompare(a.startTime))
  const recentSessions = sortedByDate.filter(s => {
    return (Date.now() - new Date(s.startTime).getTime()) / (1000 * 60 * 60 * 24) <= 7
  })
  const olderSessions = sortedByDate.filter(s => {
    const days = (Date.now() - new Date(s.startTime).getTime()) / (1000 * 60 * 60 * 24)
    return days > 7 && days <= 14
  })

  const readCalls = (toolUsage['Read'] || 0) + (toolUsage['Grep'] || 0) + (toolUsage['Glob'] || 0)
  const editCalls = (toolUsage['Edit'] || 0) + (toolUsage['Write'] || 0)
  const bashCalls = toolUsage['Bash'] || 0
  const agentCalls = toolUsage['Agent'] || 0
  const skillCalls = toolUsage['Skill'] || 0
  const bashRatio = totalToolCalls > 0 ? bashCalls / totalToolCalls : 0
  const readEditRatio = editCalls > 0 ? readCalls / editCalls : 1

  // Permission mode analysis
  const pm = overview.permissionModes || {}
  const totalPmMessages = Object.values(pm).reduce((a, b) => a + b, 0)
  const bypassCount = pm['bypassPermissions'] || 0
  const acceptEditsCount = pm['acceptEdits'] || 0
  const elevatedCount = bypassCount + acceptEditsCount
  const elevatedRate = totalPmMessages > 0 ? elevatedCount / totalPmMessages : 0

  // ═══════════════════════════════════════════════════════════════════
  // BEHAVIORAL INSIGHTS (highest priority)
  // ═══════════════════════════════════════════════════════════════════

  // Parallelization with subagents
  if (agentCalls === 0 && totalToolCalls > 500) {
    insights.push({
      id: 'no-agents',
      title: 'Unlock parallel work with subagents',
      description: 'You haven\'t used subagents yet. When Claude spawns subagents, it can research multiple files, explore alternatives, and run tests in parallel — cutting task time significantly.',
      category: 'efficiency',
      severity: 'warning',
      craft: 'reach',
      recommendation: 'Ask Claude to "use agents to explore X and Y in parallel" or "spawn an agent to research this while you implement". Add "use subagents for research tasks" to your CLAUDE.md.',
    })
  } else if (agentCalls > 0 && agentCalls < 20 && totalToolCalls > 500) {
    insights.push({
      id: 'more-agents',
      title: 'Use subagents more often',
      description: `Only ${agentCalls} subagent calls across ${sessions.length} sessions. You're underusing one of the most powerful productivity features.`,
      category: 'efficiency',
      severity: 'tip',
      craft: 'reach',
      metric: `${agentCalls} agent calls`,
      recommendation: 'Subagents shine for: codebase exploration, running multiple searches, investigating alternatives. Tell Claude "launch agents in parallel" for complex research tasks.',
    })
  } else if (agentCalls > 50) {
    insights.push({
      id: 'good-agents',
      title: 'Strong parallel work habits',
      description: `${agentCalls} subagent calls — you're effectively parallelizing research and exploration. This keeps the main context lean and speeds up complex tasks.`,
      category: 'efficiency',
      severity: 'achievement',
      craft: 'reach',
      metric: `${agentCalls} parallel tasks`,
    })
  }

  // Read-before-Edit ratio (prompting quality)
  if (editCalls > 50) {
    if (readEditRatio < 0.5) {
      insights.push({
        id: 'read-before-edit',
        title: 'Agent is editing without reading first',
        description: `Read-to-edit ratio is ${readEditRatio.toFixed(1)}x. The agent is modifying code ${Math.round(editCalls / Math.max(readCalls, 1))}x more than it reads. This leads to more mistakes and retry loops.`,
        category: 'efficiency',
        severity: 'warning',
        craft: 'autonomy',
        metric: `${readEditRatio.toFixed(1)}x read/edit`,
        recommendation: 'Add to your CLAUDE.md: "Always read the relevant file before editing it. Understand the existing code structure before making changes." This alone can reduce iteration cycles by 30-50%.',
      })
    } else if (readEditRatio > 2.0) {
      insights.push({
        id: 'good-read-ratio',
        title: 'Careful code modification habits',
        description: `Read-to-edit ratio is ${readEditRatio.toFixed(1)}x — your agent reads and understands before modifying. This typically means fewer errors and less rework.`,
        category: 'efficiency',
        severity: 'achievement',
        craft: 'autonomy',
        metric: `${readEditRatio.toFixed(1)}x read/edit`,
      })
    }
  }

  // Session length optimization (like "rest between workouts")
  const longSessions = sessions.filter(s => s.durationMinutes > 120)
  if (longSessions.length > 5) {
    insights.push({
      id: 'long-sessions',
      title: 'Break long sessions into focused sprints',
      description: `${longSessions.length} sessions exceeded 2 hours. After ~90 minutes, context quality degrades — the agent loses track of earlier decisions and starts contradicting itself.`,
      category: 'efficiency',
      severity: 'warning',
      craft: 'context',
      metric: `${longSessions.length} sessions > 2h`,
      recommendation: 'Like exercise intervals: work in 30-60 min focused sessions. Use /compact when context gets heavy. Start a /clear session for new tasks. Use /rename to bookmark important sessions for /resume later.',
    })
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT ENGINEERING INSIGHTS
  // Context = holistic curation of tokens available to the LLM:
  //   system prompts (CLAUDE.md), just-in-time retrieval, compaction,
  //   structured note-taking, sub-agent isolation, cache efficiency
  // ═══════════════════════════════════════════════════════════════════

  // Context window management (overflow + compaction)
  const highTokenSessions = sessions.filter(s => s.totalTokens > 200000)
  const overflowRate = highTokenSessions.length / sessions.length
  if (overflowRate > 0.2) {
    insights.push({
      id: 'context-overflow',
      title: 'Context pressure hurting quality',
      description: `${Math.round(overflowRate * 100)}% of sessions exceed 200K tokens. Research shows model recall degrades as context grows — every token depletes the model's finite attention budget.`,
      category: 'context',
      severity: 'warning',
      craft: 'context',
      metric: `${Math.round(overflowRate * 100)}% overflow`,
      recommendation: 'Use /compact with focus instructions ("keep the database schema and current task") to distill context. Start a /clear session for unrelated tasks. The goal: smallest set of high-signal tokens that maximize outcome.',
    })
  } else if (overflowRate <= 0.05 && sessions.length > 10) {
    insights.push({
      id: 'good-context',
      title: 'Excellent context window management',
      description: `Only ${Math.round(overflowRate * 100)}% of sessions hit high token counts. You're curating context effectively — keeping the attention budget focused.`,
      category: 'context',
      severity: 'achievement',
      craft: 'context',
      metric: `${Math.round(overflowRate * 100)}% overflow`,
    })
  }

  // Cache efficiency (stable context reuse)
  const totalCacheTokens = overview.totalCacheCreationTokens + overview.totalCacheReadTokens
  const cacheRate = totalCacheTokens > 0 ? overview.totalCacheReadTokens / totalCacheTokens : 0
  if (cacheRate < 0.3 && totalCacheTokens > 10000) {
    insights.push({
      id: 'low-cache',
      title: 'Low cache reuse — rebuild cost is high',
      description: `Cache hit rate is ${Math.round(cacheRate * 100)}%. Context is being rebuilt from scratch each turn. Stable context (CLAUDE.md rules, schemas) should be cached across turns.`,
      category: 'context',
      severity: 'warning',
      craft: 'context',
      metric: `${Math.round(cacheRate * 100)}% cache hit`,
      recommendation: 'Add stable project context to CLAUDE.md so it\'s cached across turns. Keep sessions alive longer. Use /compact to slim context without discarding it entirely.',
    })
  } else if (cacheRate > 0.7 && totalCacheTokens > 10000) {
    insights.push({
      id: 'good-cache',
      title: 'Strong cache reuse',
      description: `${Math.round(cacheRate * 100)}% cache hit rate — stable context (CLAUDE.md, project rules) is being efficiently recycled. This is good system prompt engineering.`,
      category: 'context',
      severity: 'achievement',
      craft: 'context',
      metric: `${Math.round(cacheRate * 100)}% cache hit`,
    })
  }

  // Just-in-time retrieval (vs. dumping context upfront)
  const retrievalCalls = (toolUsage['Read'] || 0) + (toolUsage['Grep'] || 0) + (toolUsage['Glob'] || 0)
  const retrievalRatio = totalToolCalls > 0 ? retrievalCalls / totalToolCalls : 0
  if (totalToolCalls > 100) {
    if (retrievalRatio > 0.4) {
      insights.push({
        id: 'good-jit-retrieval',
        title: 'Strong just-in-time context retrieval',
        description: `${Math.round(retrievalRatio * 100)}% of tool calls are targeted retrieval (Read/Grep/Glob). Like a human using bookmarks instead of memorizing everything — the agent loads data on demand rather than stuffing context upfront.`,
        category: 'context',
        severity: 'achievement',
        craft: 'context',
        metric: `${Math.round(retrievalRatio * 100)}% retrieval`,
      })
    } else if (retrievalRatio < 0.15) {
      insights.push({
        id: 'low-jit-retrieval',
        title: 'Agent isn\'t using targeted retrieval',
        description: `Only ${Math.round(retrievalRatio * 100)}% of tool calls are Read/Grep/Glob. Without just-in-time context loading, the agent is either working blind or relying on stale context rather than fresh on-demand data.`,
        category: 'context',
        severity: 'warning',
        craft: 'context',
        metric: `${Math.round(retrievalRatio * 100)}% retrieval`,
        recommendation: 'Add to CLAUDE.md: "Always read files before editing. Use Grep for targeted search instead of guessing." Progressive disclosure — explore incrementally, don\'t load everything at once.',
      })
    }
  }

  // Structured note-taking (agentic memory)
  const todoWriteCalls = toolUsage['TodoWrite'] || toolUsage['TaskCreate'] || 0
  const todoReadCalls = toolUsage['TodoRead'] || toolUsage['TaskGet'] || 0
  const notesCalls = todoWriteCalls + todoReadCalls + (toolUsage['TaskUpdate'] || 0)
  if (totalToolCalls > 200) {
    if (notesCalls > 10) {
      insights.push({
        id: 'good-notes',
        title: 'Using structured note-taking',
        description: `${notesCalls} note-taking calls (TodoWrite/TaskCreate). Structured notes persist outside the context window, letting the agent track progress across compactions and long tasks — like writing a checklist instead of holding everything in memory.`,
        category: 'context',
        severity: 'achievement',
        craft: 'context',
        metric: `${notesCalls} notes`,
      })
    } else if (notesCalls === 0 && longSessions.length > 3) {
      insights.push({
        id: 'no-notes',
        title: 'No structured note-taking in long sessions',
        description: `${longSessions.length} sessions exceeded 2 hours but none used structured notes. Without persistent notes, the agent loses track of progress, decisions, and dependencies when context is compacted.`,
        category: 'context',
        severity: 'tip',
        craft: 'context',
        metric: 'No notes used',
        recommendation: 'Ask Claude to "create a todo list" or "track your progress in tasks" for complex multi-step work. Notes survive compaction and help the agent continue coherently after context resets.',
      })
    }
  }

  // Output token density (signal-to-noise ratio)
  const outputInputRatio = overview.totalInputTokens > 0
    ? overview.totalOutputTokens / overview.totalInputTokens
    : 0
  if (sessions.length > 10 && overview.totalInputTokens > 100000) {
    if (outputInputRatio < 0.05) {
      insights.push({
        id: 'low-output-density',
        title: 'Very low output-to-input ratio',
        description: `Output is only ${(outputInputRatio * 100).toFixed(1)}% of input tokens. The agent is consuming a lot of context but producing little output — a sign of context pollution or unfocused prompts.`,
        category: 'context',
        severity: 'warning',
        craft: 'context',
        metric: `${(outputInputRatio * 100).toFixed(1)}% density`,
        recommendation: 'Write more specific prompts. Use /compact to discard irrelevant context. Avoid pasting large files into prompts — let the agent Read them just-in-time instead.',
      })
    } else if (outputInputRatio > 0.3) {
      insights.push({
        id: 'good-output-density',
        title: 'High output-to-input efficiency',
        description: `Output is ${(outputInputRatio * 100).toFixed(1)}% of input — the agent is producing substantial work relative to context consumed. Your prompts are driving productive output.`,
        category: 'context',
        severity: 'achievement',
        craft: 'context',
        metric: `${(outputInputRatio * 100).toFixed(1)}% density`,
      })
    }
  }

  // Sub-agent context isolation
  if (agentCalls > 20 && totalToolCalls > 200) {
    insights.push({
      id: 'good-context-isolation',
      title: 'Using subagents for context isolation',
      description: `${agentCalls} subagent calls keep deep exploration out of the main context window. Each subagent works with a clean context and returns a condensed summary — the main agent stays focused.`,
      category: 'context',
      severity: 'achievement',
      craft: 'context',
      metric: `${agentCalls} isolated tasks`,
    })
  }

  // System prompt engineering (CLAUDE.md / agent.md maintenance)
  const totalSPEdits = overview.totalSystemPromptEdits
  if (sessions.length > 10) {
    if (totalSPEdits === 0) {
      insights.push({
        id: 'no-system-prompt-updates',
        title: 'No CLAUDE.md / agent.md updates detected',
        description: 'Your system prompt files (CLAUDE.md for Claude Code, agent.md for Codex) are your most powerful context engineering tool — they\'re loaded into every turn and cached across interactions. Zero edits means you may be missing out on persistent project-level instructions.',
        category: 'context',
        severity: 'warning',
        craft: 'context',
        metric: '0 edits',
        recommendation: 'Create or update your CLAUDE.md with: project architecture, coding conventions, common pitfalls, and behavioral rules ("always read before editing"). This context is cached and reused every turn — high-signal tokens that compound over time.',
      })
    } else if (totalSPEdits >= 5) {
      insights.push({
        id: 'active-system-prompt',
        title: 'Actively maintaining your system prompt',
        description: `${totalSPEdits} edits to CLAUDE.md/agent.md — you're iterating on your system prompt like a well-tuned configuration. Each improvement compounds across every future session, making the agent smarter about your project's specific context.`,
        category: 'context',
        severity: 'achievement',
        craft: 'context',
        metric: `${totalSPEdits} edits`,
      })
    } else {
      const editsPerSession = totalSPEdits / sessions.length
      insights.push({
        id: 'some-system-prompt',
        title: 'Keep iterating on your system prompt',
        description: `${totalSPEdits} edits to CLAUDE.md/agent.md across ${sessions.length} sessions. The best context engineers treat their system prompt as a living document — update it when you discover rules the agent should follow, files it should know about, or patterns it should prefer.`,
        category: 'context',
        severity: 'tip',
        craft: 'context',
        metric: `${totalSPEdits} edits`,
        recommendation: 'After each session, ask yourself: "Did I repeat any instruction that should be in CLAUDE.md?" Add project rules, schemas, and conventions. High-signal stable context that gets cached = free quality improvement on every turn.',
      })
    }
  }

  // Session naming / organization
  const avgSessionTokens = overview.totalTokens / Math.max(sessions.length, 1)
  if (avgSessionTokens > 150000 && longSessions.length <= 5) {
    insights.push({
      id: 'context-tips',
      title: 'Keep sessions organized for easy recall',
      description: 'Your sessions are token-heavy. Named sessions are easier to find and resume later.',
      category: 'context',
      severity: 'tip',
      craft: 'context',
      recommendation: 'Use /rename to label sessions by task ("fix auth bug", "add search"). Use /resume to pick up where you left off. Use /context mid-session to check how much window remains before it degrades.',
    })
  }

  // Interruptions (agent doing wrong things)
  const totalInterruptions = overview.totalUserInterruptions
  if (totalInterruptions > 10) {
    const interruptRate = totalInterruptions / overview.totalMessages * 100
    insights.push({
      id: 'high-interruptions',
      title: 'Frequent interruptions — improve your prompts',
      description: `You interrupted the agent ${totalInterruptions} times (${interruptRate.toFixed(1)}% of messages). Each interruption wastes context and tokens on work that gets thrown away.`,
      category: 'efficiency',
      severity: 'warning',
      craft: 'autonomy',
      metric: `${totalInterruptions} interruptions`,
      recommendation: 'Be more specific upfront: describe the expected output, mention files to avoid, state constraints. Use /plan for complex tasks so you can review the approach before execution. Add common rules to CLAUDE.md.',
    })
  } else if (totalInterruptions <= 3 && sessions.length > 20) {
    insights.push({
      id: 'low-interruptions',
      title: 'Clean collaboration — low interruption rate',
      description: `Only ${totalInterruptions} interruptions across ${sessions.length} sessions. Your prompts are clear and the agent rarely does unwanted work.`,
      category: 'efficiency',
      severity: 'achievement',
      craft: 'autonomy',
      metric: `${totalInterruptions} interruptions`,
    })
  }

  // Permission mode — trust signals
  if (totalPmMessages > 10) {
    if (bypassCount > 0) {
      const bypassRate = Math.round((bypassCount / totalPmMessages) * 100)
      insights.push({
        id: 'yolo-mode',
        title: `Auto-accept mode used (${bypassRate}% of messages)`,
        description: `You used full auto-accept (bypass permissions) for ${bypassCount} messages. This shows high trust in the agent and enables maximum autonomy.`,
        category: 'efficiency',
        severity: 'achievement',
        craft: 'autonomy',
        metric: `${bypassRate}% auto`,
      })
    }
    if (acceptEditsCount > 0 && bypassCount === 0) {
      const acceptRate = Math.round((acceptEditsCount / totalPmMessages) * 100)
      insights.push({
        id: 'accept-edits',
        title: `Accept-edits mode used (${acceptRate}% of messages)`,
        description: `You granted "always allow" for edits in ${acceptRate}% of messages — a good balance of trust and oversight.`,
        category: 'efficiency',
        severity: 'achievement',
        craft: 'autonomy',
        metric: `${acceptRate}% accept`,
      })
    }
    if (elevatedRate < 0.1) {
      insights.push({
        id: 'low-trust',
        title: 'Consider granting more permissions',
        description: `Only ${Math.round(elevatedRate * 100)}% of your messages used elevated permissions. Approving each tool call individually slows you down.`,
        category: 'efficiency',
        severity: 'tip',
        craft: 'autonomy',
        metric: `${Math.round(elevatedRate * 100)}% elevated`,
        recommendation: 'Try "Yes, and don\'t ask again" for safe operations (Read, Grep, Glob). For trusted projects, use auto-accept mode to let the agent work uninterrupted. You can always /permissions to revoke.',
      })
    }
  }

  // API errors / rate limits
  const totalApiErrors = overview.totalApiErrors
  if (totalApiErrors > 5) {
    insights.push({
      id: 'api-errors',
      title: 'Rate limits impacting your flow',
      description: `${totalApiErrors} API errors (mostly rate limits). Each one breaks your flow and forces you to wait or retry.`,
      category: 'efficiency',
      severity: 'tip',
      craft: 'throughput',
      metric: `${totalApiErrors} errors`,
      recommendation: 'When hitting rate limits: use /effort low for quick tasks, break work into smaller sessions, or use /btw for side questions instead of new full prompts.',
    })
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW INSIGHTS (medium priority)
  // ═══════════════════════════════════════════════════════════════════

  // CLAUDE.md / prompting infrastructure
  if (skillCalls === 0 && totalToolCalls > 200) {
    insights.push({
      id: 'no-skills',
      title: 'Create reusable skills for repeated tasks',
      description: 'You haven\'t used custom skills yet. If you find yourself giving the same instructions repeatedly, a skill captures that workflow in a single command.',
      category: 'discovery',
      severity: 'tip',
      craft: 'reach',
      recommendation: 'Create .claude/skills/my-workflow/SKILL.md for any task you do regularly: deploy scripts, code review checklists, testing patterns. Type /skills to see what\'s available.',
    })
  }

  // Bash overuse
  if (bashRatio > 0.4 && totalToolCalls > 100) {
    insights.push({
      id: 'bash-heavy',
      title: 'Let the agent use specialized tools',
      description: `${Math.round(bashRatio * 100)}% of tool calls are Bash commands. Specialized tools (Read, Edit, Grep) are faster, safer, and produce better results than shell equivalents.`,
      category: 'tools',
      severity: 'tip',
      craft: 'reach',
      metric: `${Math.round(bashRatio * 100)}% Bash`,
      recommendation: 'Add to CLAUDE.md: "Prefer Read over cat, Edit over sed, Grep over grep. Only use Bash for commands that require shell execution." This also makes tool calls easier to review.',
    })
  }

  // Peak productivity
  insights.push({
    id: 'peak-hour',
    title: `Your peak coding hour: ${peakHour}:00 on ${mostActiveDay}s`,
    description: `Schedule your most complex AI-assisted tasks during this window when you're most productive and attentive. Use simpler tasks or autonomous runs during off-peak hours.`,
    category: 'habits',
    severity: 'tip',
    craft: 'flow',
    metric: `${peakHour}:00`,
  })

  // ═══════════════════════════════════════════════════════════════════
  // STREAK & HABIT INSIGHTS
  // ═══════════════════════════════════════════════════════════════════

  if (streaks.current >= 7) {
    insights.push({
      id: 'streak-hot',
      title: `${streaks.current}-day coding streak!`,
      description: `Consistency builds mastery. You've been using your AI agent every day for ${streaks.current} days — your prompts and workflows are likely improving steadily.`,
      category: 'streak',
      severity: 'achievement',
      craft: 'flow',
      metric: `${streaks.current} days`,
    })
  } else if (streaks.current >= 3) {
    insights.push({
      id: 'streak-building',
      title: `${streaks.current}-day streak — keep going!`,
      description: `Your longest was ${streaks.longest} days. Consistent daily practice with AI coding tools is the fastest way to master human-AI collaboration.`,
      category: 'streak',
      severity: 'achievement',
      craft: 'flow',
      metric: `${streaks.current}/${streaks.longest}d`,
    })
  } else if (streaks.current === 0 && streaks.longest > 3) {
    insights.push({
      id: 'streak-broken',
      title: 'Streak broken — start fresh today',
      description: `Your ${streaks.longest}-day streak ended. Like a fitness routine, consistency matters more than intensity. One session today restarts your momentum.`,
      category: 'streak',
      severity: 'tip',
      craft: 'flow',
      metric: `Best: ${streaks.longest}d`,
    })
  }

  // Usage trend
  if (recentSessions.length > 3 && olderSessions.length > 3) {
    const recentPerDay = recentSessions.length / 7
    const olderPerDay = olderSessions.length / 7
    if (recentPerDay > olderPerDay * 1.5) {
      insights.push({
        id: 'usage-up',
        title: 'Accelerating AI adoption',
        description: `${recentPerDay.toFixed(1)} sessions/day this week vs ${olderPerDay.toFixed(1)} last week. You're leaning deeper into AI-assisted development.`,
        category: 'habits',
        severity: 'achievement',
        craft: 'flow',
        metric: `${recentPerDay.toFixed(1)}/day`,
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // COST INSIGHTS (lower priority — kept but not prominent)
  // ═══════════════════════════════════════════════════════════════════

  if (recentSessions.length > 3 && olderSessions.length > 3) {
    const recentCost = recentSessions.reduce((sum, s) => sum + s.costUSD, 0)
    const olderCost = olderSessions.reduce((sum, s) => sum + s.costUSD, 0)
    if (recentCost < olderCost * 0.7) {
      insights.push({
        id: 'cost-down',
        title: 'More efficient this week',
        description: `Token usage dropped ${Math.round((1 - recentCost / olderCost) * 100)}% vs last week while maintaining output. Your prompts may be getting more precise.`,
        category: 'cost',
        severity: 'achievement',
        craft: 'throughput',
        metric: `-${Math.round((1 - recentCost / olderCost) * 100)}%`,
      })
    }
  }

  // Parallel session usage
  const parallelDays = new Map<string, number>()
  for (const s of sessions) {
    if (!s.startTime) continue
    const date = s.startTime.slice(0, 10)
    parallelDays.set(date, (parallelDays.get(date) || 0) + 1)
  }
  const avgParallelSessions = parallelDays.size > 0
    ? Array.from(parallelDays.values()).reduce((a, b) => a + b, 0) / parallelDays.size
    : 0
  if (avgParallelSessions >= 3 && sessions.length > 10) {
    insights.push({
      id: 'good-parallel',
      title: 'Strong parallel session usage',
      description: `Averaging ${avgParallelSessions.toFixed(1)} sessions/day — you're running multiple tasks in parallel, maximizing throughput.`,
      category: 'efficiency',
      severity: 'achievement',
      craft: 'throughput',
      metric: `${avgParallelSessions.toFixed(1)} sessions/day`,
    })
  } else if (avgParallelSessions < 1.5 && sessions.length > 10) {
    insights.push({
      id: 'low-parallel',
      title: 'Try running sessions in parallel',
      description: `Averaging ${avgParallelSessions.toFixed(1)} sessions/day. Running multiple sessions on different tasks lets you keep working while the agent handles long-running work.`,
      category: 'efficiency',
      severity: 'tip',
      craft: 'throughput',
      metric: `${avgParallelSessions.toFixed(1)} sessions/day`,
      recommendation: 'Open a second terminal for a separate task while waiting on the first. Use /rename to label each session by task so you can track them.',
    })
  }

  // ── Compute CRAFT dimension scores (each 0–100) ──

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

  // C — Context Engineering: holistic curation of tokens available to the LLM
  //   system prompt maintenance + cache efficiency + overflow avoidance + session length
  //   + just-in-time retrieval + structured note-taking + output density + sub-agent isolation
  const totalCache = overview.totalCacheCreationTokens + overview.totalCacheReadTokens
  const cacheHitRate = totalCache > 0 ? overview.totalCacheReadTokens / totalCache : 0
  const shortSessionRate = 1 - (longSessions.length / Math.max(sessions.length, 1))
  const jitRetrievalRate = totalToolCalls > 0
    ? ((toolUsage['Read'] || 0) + (toolUsage['Grep'] || 0) + (toolUsage['Glob'] || 0)) / totalToolCalls
    : 0
  const noteTakingRate = totalToolCalls > 0
    ? ((toolUsage['TodoWrite'] || 0) + (toolUsage['TaskCreate'] || 0) + (toolUsage['TodoRead'] || 0) + (toolUsage['TaskGet'] || 0) + (toolUsage['TaskUpdate'] || 0)) / Math.max(sessions.length, 1)
    : 0
  const outputDensity = overview.totalInputTokens > 0
    ? Math.min(overview.totalOutputTokens / overview.totalInputTokens / 0.3, 1) // 0.3 ratio = full marks
    : 0
  const agentIsolationRate = totalToolCalls > 0
    ? Math.min((toolUsage['Agent'] || 0) / Math.max(sessions.length, 1) / 3, 1) // 3 agent calls/session = full marks
    : 0
  const sysPromptScore = Math.min(overview.totalSystemPromptEdits / 5, 1) // 5+ edits = full marks
  const contextScore = clamp(
    (sysPromptScore * 15) +                            // system prompt engineering (CLAUDE.md/agent.md)
    (cacheHitRate * 15) +                              // stable context reuse
    ((1 - Math.min(overflowRate, 1)) * 15) +           // context window management
    (shortSessionRate * 10) +                          // session length discipline
    (Math.min(jitRetrievalRate / 0.4, 1) * 20) +      // just-in-time retrieval
    (Math.min(noteTakingRate / 2, 1) * 10) +           // structured note-taking
    (outputDensity * 10) +                             // output token density
    (agentIsolationRate * 5)                           // sub-agent context isolation
  )

  // R — Reach: tool diversity + subagent usage + skill adoption
  const uniqueTools = Object.keys(toolUsage).length
  const toolDiversityScore = Math.min(uniqueTools / 12, 1) * 35
  const agentScore = agentCalls === 0 ? 0 : Math.min(agentCalls / 50, 1) * 35
  const skillScore = skillCalls === 0 ? 0 : Math.min(skillCalls / 20, 1) * 30
  const reachScore = clamp(toolDiversityScore + agentScore + skillScore)

  // A — Autonomy: assistant/user ratio + low interruptions + read-before-edit + permission trust
  const autonomyRatio = overview.totalAssistantMessages / Math.max(overview.totalUserMessages, 1)
  const autonomyRatioScore = Math.min(autonomyRatio / 3, 1) * 25
  const interruptScore = totalInterruptions === 0 ? 25 : Math.max(0, 25 - (totalInterruptions / overview.totalMessages * 100) * 8)
  const readEditScore = Math.min(readEditRatio / 3, 1) * 25
  const permTrustScore = Math.min(elevatedRate, 1) * 25 // higher elevated permission rate = more trust
  const autonomyScore = clamp(autonomyRatioScore + interruptScore + readEditScore + permTrustScore)

  // F — Flow: streak + daily consistency + active days coverage
  const daysCovered = uniqueDates.size
  const totalPossibleDays = sessions.length > 0
    ? Math.max(1, Math.ceil((Date.now() - new Date(sessions[sessions.length - 1]?.startTime || Date.now()).getTime()) / (1000 * 60 * 60 * 24)))
    : 1
  const consistencyRate = Math.min(daysCovered / totalPossibleDays, 1)
  const streakScore = Math.min(streaks.current / 14, 1) * 35
  const consistencyScore = consistencyRate * 35
  const activeDaysScore = Math.min(daysCovered / 30, 1) * 30
  const flowScore = clamp(streakScore + consistencyScore + activeDaysScore)

  // T — Throughput: cost efficiency + output volume + parallel sessions + low error rate
  const avgCostEfficiency = avgCost > 0 ? Math.min(30 / avgCost, 1) : 0 // $30/session = baseline
  const outputVolume = Math.min(overview.totalOutputTokens / 1_000_000, 1) // 1M output tokens = full marks
  const errorRate = overview.totalApiErrors / Math.max(sessions.length, 1)
  const lowErrorScore = Math.max(0, 1 - errorRate / 5) // 5 errors/session = 0
  // Parallel sessions: compute avg sessions per active day
  const daySessions = new Map<string, number>()
  for (const s of sessions) {
    if (!s.startTime) continue
    const date = s.startTime.slice(0, 10)
    daySessions.set(date, (daySessions.get(date) || 0) + 1)
  }
  const avgParallel = daySessions.size > 0
    ? Array.from(daySessions.values()).reduce((a, b) => a + b, 0) / daySessions.size
    : 0
  const parallelScore = Math.min(avgParallel / 4, 1) // 4+ sessions/day = full marks
  const throughputScore = clamp(
    (avgCostEfficiency * 25) + (outputVolume * 25) + (parallelScore * 25) + (lowErrorScore * 25)
  )

  const craft: CraftScores = {
    context: contextScore,
    reach: reachScore,
    autonomy: autonomyScore,
    flow: flowScore,
    throughput: throughputScore,
  }

  // Overall score = weighted average of CRAFT dimensions
  const score = clamp(
    craft.context * 0.20 +
    craft.reach * 0.20 +
    craft.autonomy * 0.25 +
    craft.flow * 0.15 +
    craft.throughput * 0.20
  )

  const scoreLabel =
    score >= 85 ? 'Elite' :
    score >= 70 ? 'Strong' :
    score >= 55 ? 'Building' :
    score >= 40 ? 'Getting Started' :
    'Needs Attention'

  return {
    score,
    scoreLabel,
    craft,
    insights,
    stats: {
      avgCostPerSession: avgCost,
      avgDurationMinutes: avgDuration,
      avgMessagesPerSession: avgMessages,
      avgToolCallsPerSession: avgToolCalls,
      mostUsedModel,
      mostActiveDay,
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
      totalDays: uniqueDates.size,
      peakHour,
    },
  }
}
