// ─── Agent Personality Analysis ─────────────────────────────────────
// Derives Big Five (OCEAN) and MBTI personality profiles from
// conversation trace behavioral signals.

import type { SessionSummary, UsageData } from './parse-logs'

// ─── Types ───────────────────────────────────────────────────────────

export interface BigFiveProfile {
  openness: number          // 0-100: tool diversity, approach variety
  conscientiousness: number // 0-100: read-before-edit, low error/revert rate
  extraversion: number      // 0-100: output verbosity, proactive communication
  agreeableness: number     // 0-100: compliance, low friction, follows directions
  neuroticism: number       // 0-100: behavioral variance, instability (inverse = stability)
}

export interface MBTIProfile {
  ei: number  // -100 (Introversion) to +100 (Extraversion): verbosity ratio
  sn: number  // -100 (Sensing) to +100 (iNtuition): concrete vs. abstract tool patterns
  tf: number  // -100 (Thinking) to +100 (Feeling): execution vs. explanation ratio
  jp: number  // -100 (Judging) to +100 (Perceiving): structured vs. exploratory workflow
}

export interface PersonalityProfile {
  bigFive: BigFiveProfile
  mbti: MBTIProfile
  mbtiType: string         // e.g., "ISTJ"
  signals: PersonalitySignals
  fitScores: TaskFitScores
  recommendations: PersonalityRecommendation[]
  systemPrompt: string
}

export interface PersonalitySignals {
  toolDiversity: number          // unique tools / total tool calls
  readBeforeEditRatio: number    // read calls before edit / total edits
  outputInputRatio: number       // output tokens / input tokens
  avgAssistantMsgLength: number  // avg output tokens per assistant message
  bashToTotalRatio: number       // bash calls / total tool calls
  editToReadRatio: number        // edit calls / read calls
  toolTransitionEntropy: number  // entropy of tool bigrams
  sessionDurationVariance: number// CV of session durations
  avgToolCallsPerMessage: number // tool calls per assistant message
  contextOverflowRate: number    // sessions with high token density
}

export interface TaskFitScores {
  frontendDev: number
  backendDev: number
  dataEngineering: number
  devOps: number
  debugging: number
  refactoring: number
}

export interface PersonalityRecommendation {
  trait: string
  current: string
  ideal: string
  adjustment: string
  promptSnippet: string
}

// ─── Signal Extraction ───────────────────────────────────────────────

function extractSignals(data: UsageData): PersonalitySignals {
  const sessions = data.sessions
  const toolUsage = data.toolUsage

  const totalToolCalls = Object.values(toolUsage).reduce((a, b) => a + b, 0)
  const uniqueTools = Object.keys(toolUsage).length

  // Tool diversity: unique tools / total calls (normalized)
  const toolDiversity = totalToolCalls > 0
    ? Math.min(1, uniqueTools / Math.sqrt(totalToolCalls))
    : 0

  // Read-before-Edit ratio from tool patterns
  const readCalls = (toolUsage['Read'] || 0) + (toolUsage['Grep'] || 0) + (toolUsage['Glob'] || 0)
  const editCalls = (toolUsage['Edit'] || 0) + (toolUsage['Write'] || 0)
  const readBeforeEditRatio = editCalls > 0
    ? Math.min(2, readCalls / editCalls)
    : 1

  // Output/Input token ratio
  const totalOutput = data.overview.totalOutputTokens
  const totalInput = data.overview.totalInputTokens
  const outputInputRatio = totalInput > 0 ? totalOutput / totalInput : 1

  // Average assistant message length (tokens per message)
  const totalAssistantMsgs = data.overview.totalAssistantMessages
  const avgAssistantMsgLength = totalAssistantMsgs > 0
    ? totalOutput / totalAssistantMsgs
    : 0

  // Bash to total ratio
  const bashCalls = toolUsage['Bash'] || 0
  const bashToTotalRatio = totalToolCalls > 0 ? bashCalls / totalToolCalls : 0

  // Edit to Read ratio
  const editToReadRatio = readCalls > 0 ? editCalls / readCalls : 0

  // Tool transition entropy (approximated from tool distribution)
  const toolProbs = Object.values(toolUsage).map(c => c / totalToolCalls)
  const toolTransitionEntropy = totalToolCalls > 0
    ? -toolProbs.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0)
    : 0

  // Session duration variance (coefficient of variation)
  const durations = sessions.map(s => s.durationMinutes).filter(d => d > 0)
  const meanDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0
  const varianceDuration = durations.length > 1
    ? durations.reduce((sum, d) => sum + Math.pow(d - meanDuration, 2), 0) / durations.length
    : 0
  const sessionDurationVariance = meanDuration > 0
    ? Math.sqrt(varianceDuration) / meanDuration
    : 0

  // Tool calls per assistant message
  const avgToolCallsPerMessage = totalAssistantMsgs > 0
    ? totalToolCalls / totalAssistantMsgs
    : 0

  // Context overflow rate (sessions where tokens > 100k suggesting long context usage)
  const highTokenSessions = sessions.filter(s => s.totalTokens > 100000).length
  const contextOverflowRate = sessions.length > 0
    ? highTokenSessions / sessions.length
    : 0

  return {
    toolDiversity,
    readBeforeEditRatio,
    outputInputRatio,
    avgAssistantMsgLength,
    bashToTotalRatio,
    editToReadRatio,
    toolTransitionEntropy,
    sessionDurationVariance,
    avgToolCallsPerMessage,
    contextOverflowRate,
  }
}

// ─── Big Five Derivation ─────────────────────────────────────────────

function deriveBigFive(signals: PersonalitySignals): BigFiveProfile {
  // Openness: tool diversity + transition entropy (explores many approaches)
  const openness = clamp(
    (signals.toolDiversity * 60) +
    (Math.min(signals.toolTransitionEntropy / 4, 1) * 40),
    0, 100
  )

  // Conscientiousness: read-before-edit ratio + low bash ratio (careful, methodical)
  const conscientiousness = clamp(
    (Math.min(signals.readBeforeEditRatio / 2, 1) * 60) +
    ((1 - signals.bashToTotalRatio) * 20) +
    ((1 - signals.contextOverflowRate) * 20),
    0, 100
  )

  // Extraversion: output verbosity + tool calls per message (communicative, active)
  const extraversion = clamp(
    (Math.min(signals.outputInputRatio / 2, 1) * 40) +
    (Math.min(signals.avgAssistantMsgLength / 2000, 1) * 30) +
    (Math.min(signals.avgToolCallsPerMessage / 3, 1) * 30),
    0, 100
  )

  // Agreeableness: low edit-to-read ratio (listens more than changes) + consistency
  const agreeableness = clamp(
    ((1 - Math.min(signals.editToReadRatio, 1)) * 40) +
    (Math.min(signals.readBeforeEditRatio / 2, 1) * 40) +
    ((1 - signals.sessionDurationVariance) * 20),
    0, 100
  )

  // Neuroticism: high variance + high overflow rate + inconsistent patterns
  const neuroticism = clamp(
    (signals.sessionDurationVariance * 40) +
    (signals.contextOverflowRate * 40) +
    ((1 - signals.toolDiversity) * 20),
    0, 100
  )

  return { openness, conscientiousness, extraversion, agreeableness, neuroticism }
}

// ─── MBTI Derivation ─────────────────────────────────────────────────

function deriveMBTI(signals: PersonalitySignals): MBTIProfile {
  // E/I: Output verbosity — verbose = Extraversion, concise = Introversion
  const ei = clamp(
    ((signals.outputInputRatio - 0.5) * 100) +
    ((signals.avgAssistantMsgLength / 2000 - 0.5) * 100),
    -100, 100
  )

  // S/N: Read/Grep heavy (concrete, detail-oriented) = Sensing; diverse/exploratory = iNtuition
  const sn = clamp(
    ((signals.toolDiversity - 0.3) * 150) +
    ((signals.toolTransitionEntropy / 4 - 0.5) * 100),
    -100, 100
  )

  // T/F: Bash/Edit heavy (execution-focused) = Thinking; Read/explanation = Feeling
  const tf = clamp(
    ((signals.bashToTotalRatio - 0.2) * -200) +
    ((signals.editToReadRatio - 0.5) * -100),
    -100, 100
  )

  // J/P: Low variance (structured) = Judging; high variance (exploratory) = Perceiving
  const jp = clamp(
    ((signals.sessionDurationVariance - 0.5) * 100) +
    ((signals.contextOverflowRate - 0.2) * 100),
    -100, 100
  )

  return { ei, sn, tf, jp }
}

function mbtiTypeFromProfile(mbti: MBTIProfile): string {
  return (
    (mbti.ei >= 0 ? 'E' : 'I') +
    (mbti.sn >= 0 ? 'N' : 'S') +
    (mbti.tf >= 0 ? 'F' : 'T') +
    (mbti.jp >= 0 ? 'P' : 'J')
  )
}

// ─── Task Fit Scores ─────────────────────────────────────────────────
// Ideal personality profiles for different task types

const IDEAL_PROFILES: Record<string, BigFiveProfile> = {
  frontendDev: {
    openness: 80,           // Creative, explores UI approaches
    conscientiousness: 60,  // Moderate — needs iteration
    extraversion: 70,       // Communicative about visual choices
    agreeableness: 75,      // Responsive to design feedback
    neuroticism: 20,        // Stable under visual debugging
  },
  backendDev: {
    openness: 50,           // Moderate — proven patterns preferred
    conscientiousness: 90,  // Very careful with data/logic
    extraversion: 40,       // Concise, efficient
    agreeableness: 60,      // Follows specs but pushes back on bad ideas
    neuroticism: 15,        // Very stable
  },
  dataEngineering: {
    openness: 45,           // Conservative with data pipelines
    conscientiousness: 95,  // Extremely careful — data integrity matters
    extraversion: 35,       // Quiet, focused
    agreeableness: 55,      // Follows standards
    neuroticism: 10,        // Rock stable
  },
  devOps: {
    openness: 55,           // Moderate exploration
    conscientiousness: 85,  // Careful with infrastructure
    extraversion: 50,       // Communicates clearly about status
    agreeableness: 65,      // Follows runbooks
    neuroticism: 15,        // Calm under pressure
  },
  debugging: {
    openness: 70,           // Explores multiple hypotheses
    conscientiousness: 80,  // Methodical investigation
    extraversion: 55,       // Explains findings
    agreeableness: 50,      // Challenges assumptions
    neuroticism: 25,        // Handles frustration
  },
  refactoring: {
    openness: 65,           // Sees better patterns
    conscientiousness: 90,  // Doesn't break existing behavior
    extraversion: 45,       // Shows what changed, concisely
    agreeableness: 70,      // Respects existing code style
    neuroticism: 15,        // Steady, incremental
  },
}

function computeFitScores(actual: BigFiveProfile): TaskFitScores {
  const scores: Record<string, number> = {}
  for (const [task, ideal] of Object.entries(IDEAL_PROFILES)) {
    const distance = Math.sqrt(
      Math.pow(actual.openness - ideal.openness, 2) +
      Math.pow(actual.conscientiousness - ideal.conscientiousness, 2) +
      Math.pow(actual.extraversion - ideal.extraversion, 2) +
      Math.pow(actual.agreeableness - ideal.agreeableness, 2) +
      Math.pow(actual.neuroticism - ideal.neuroticism, 2)
    )
    // Max possible distance is sqrt(5 * 100^2) ≈ 223.6
    scores[task] = Math.round(Math.max(0, 100 - (distance / 2.236)))
  }
  return scores as unknown as TaskFitScores
}

// ─── Recommendations & System Prompt Generation ──────────────────────

function generateRecommendations(
  actual: BigFiveProfile,
  targetTask: string
): PersonalityRecommendation[] {
  const ideal = IDEAL_PROFILES[targetTask] || IDEAL_PROFILES.backendDev
  const recommendations: PersonalityRecommendation[] = []
  const threshold = 15 // Only recommend if gap > threshold

  const traitMap: { trait: keyof BigFiveProfile; label: string }[] = [
    { trait: 'openness', label: 'Openness' },
    { trait: 'conscientiousness', label: 'Conscientiousness' },
    { trait: 'extraversion', label: 'Extraversion' },
    { trait: 'agreeableness', label: 'Agreeableness' },
    { trait: 'neuroticism', label: 'Neuroticism' },
  ]

  for (const { trait, label } of traitMap) {
    const gap = ideal[trait] - actual[trait]
    if (Math.abs(gap) <= threshold) continue

    const direction = gap > 0 ? 'increase' : 'decrease'
    const currentLevel = describeLevel(actual[trait])
    const idealLevel = describeLevel(ideal[trait])

    recommendations.push({
      trait: label,
      current: `${currentLevel} (${Math.round(actual[trait])})`,
      ideal: `${idealLevel} (${Math.round(ideal[trait])})`,
      adjustment: `${direction} by ${Math.abs(Math.round(gap))} points`,
      promptSnippet: getPromptSnippet(trait, direction, targetTask),
    })
  }

  return recommendations
}

function describeLevel(score: number): string {
  if (score >= 80) return 'Very High'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Moderate'
  if (score >= 20) return 'Low'
  return 'Very Low'
}

function getPromptSnippet(
  trait: keyof BigFiveProfile,
  direction: string,
  task: string
): string {
  const snippets: Record<string, Record<string, string>> = {
    openness: {
      increase: 'Explore multiple alternative approaches before settling on a solution. When faced with a problem, propose at least 2-3 different strategies and explain the trade-offs of each.',
      decrease: 'Prefer established, proven patterns and conventions. Avoid novel approaches when standard solutions exist. Stick to the project\'s existing architectural patterns.',
    },
    conscientiousness: {
      increase: 'Always read and understand existing code before making changes. Verify your changes don\'t break existing functionality. Run tests after every modification. Double-check edge cases.',
      decrease: 'Move faster with less verification. Trust that the existing test suite will catch issues. Focus on getting a working solution rather than perfecting every edge case.',
    },
    extraversion: {
      increase: 'Explain your reasoning and approach before writing code. Provide context for why you chose a particular solution. Proactively flag potential issues or improvements you notice.',
      decrease: 'Be concise. Write code, not explanations. Only comment when the logic is non-obvious. Skip preamble and get straight to implementation.',
    },
    agreeableness: {
      increase: 'Follow the user\'s directions closely. When you disagree with an approach, implement it as requested first, then briefly mention concerns. Adapt to the project\'s existing style.',
      decrease: 'Push back when you see a better approach. If the requested change would introduce technical debt, explain why and propose alternatives. Prioritize code quality over compliance.',
    },
    neuroticism: {
      increase: 'Be more cautious. Flag potential risks and failure modes. Ask clarifying questions before making assumptions. Prefer reversible changes.',
      decrease: 'Stay calm and methodical. Don\'t overthink edge cases that are unlikely to occur. Trust your analysis and commit to your approach confidently.',
    },
  }

  return snippets[trait]?.[direction] || ''
}

function generateSystemPrompt(
  recommendations: PersonalityRecommendation[],
  targetTask: string,
  mbtiType: string
): string {
  if (recommendations.length === 0) {
    return `# Agent Personality Configuration\n\nCurrent personality profile (${mbtiType}) is well-suited for ${formatTaskName(targetTask)}. No adjustments needed.`
  }

  const taskDescriptions: Record<string, string> = {
    frontendDev: 'frontend development — building UI components, styling, responsive design, and visual debugging',
    backendDev: 'backend development — API design, business logic, database interactions, and server-side architecture',
    dataEngineering: 'data engineering — ETL pipelines, data parsing, web scraping, and data quality assurance',
    devOps: 'DevOps — CI/CD pipelines, infrastructure, deployment, and monitoring',
    debugging: 'debugging — root cause analysis, reproducing issues, and systematic problem investigation',
    refactoring: 'refactoring — improving code structure, reducing duplication, and modernizing patterns without changing behavior',
  }

  let prompt = `# Agent Personality Configuration for ${formatTaskName(targetTask)}\n\n`
  prompt += `You are assisting with ${taskDescriptions[targetTask] || targetTask}.\n\n`
  prompt += `## Behavioral Guidelines\n\n`

  for (const rec of recommendations) {
    prompt += `### ${rec.trait} Adjustment\n`
    prompt += `${rec.promptSnippet}\n\n`
  }

  prompt += `## Task-Specific Instructions\n\n`

  switch (targetTask) {
    case 'frontendDev':
      prompt += `- When making visual changes, describe what the user should expect to see\n`
      prompt += `- Suggest screenshots for verification after UI modifications\n`
      prompt += `- Consider accessibility and responsive design in every component\n`
      break
    case 'backendDev':
      prompt += `- Validate input at system boundaries, trust internal interfaces\n`
      prompt += `- Consider error handling, but don't over-engineer for impossible scenarios\n`
      prompt += `- Write clear, self-documenting function signatures\n`
      break
    case 'dataEngineering':
      prompt += `- Always validate data at ingestion boundaries\n`
      prompt += `- Log record counts at each pipeline stage for auditability\n`
      prompt += `- Handle malformed data gracefully — skip and log, don't crash\n`
      break
    case 'devOps':
      prompt += `- Prefer idempotent operations\n`
      prompt += `- Always consider rollback paths before making infrastructure changes\n`
      prompt += `- Document any manual steps required\n`
      break
    case 'debugging':
      prompt += `- Form hypotheses before investigating. State what you expect to find\n`
      prompt += `- Narrow down with binary search — don't read everything\n`
      prompt += `- Preserve and explain the root cause, not just the fix\n`
      break
    case 'refactoring':
      prompt += `- Ensure behavior is unchanged — preserve all existing tests\n`
      prompt += `- Make small, incremental changes. Each step should be independently valid\n`
      prompt += `- Don't change interfaces unless necessary for the refactor\n`
      break
  }

  return prompt
}

function formatTaskName(task: string): string {
  const names: Record<string, string> = {
    frontendDev: 'Frontend Development',
    backendDev: 'Backend Development',
    dataEngineering: 'Data Engineering',
    devOps: 'DevOps',
    debugging: 'Debugging',
    refactoring: 'Refactoring',
  }
  return names[task] || task
}

// ─── Main Analysis Function ──────────────────────────────────────────

export function analyzePersonality(
  data: UsageData,
  targetTask: string = 'backendDev'
): PersonalityProfile {
  const signals = extractSignals(data)
  const bigFive = deriveBigFive(signals)
  const mbti = deriveMBTI(signals)
  const mbtiType = mbtiTypeFromProfile(mbti)
  const fitScores = computeFitScores(bigFive)
  const recommendations = generateRecommendations(bigFive, targetTask)
  const systemPrompt = generateSystemPrompt(recommendations, targetTask, mbtiType)

  return {
    bigFive,
    mbti,
    mbtiType,
    signals,
    fitScores,
    recommendations,
    systemPrompt,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value * 100) / 100))
}
