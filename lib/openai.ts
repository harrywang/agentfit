// ─── OpenAI Message Classification Engine ──────────────────────────
// Classifies user messages from Claude Code sessions by type, role,
// skill level, and sentiment using OpenAI's API.
// Ported from bizpub-cc/scripts/prepare_batch.py

import OpenAI from 'openai'
import type { ChatMessage } from './session-detail'

// ─── Types ──────────────────────────────────────────────────────────

export interface MessageClassification {
  messageIndex: number
  messagePreview: string
  messageType: string
  role: string
  skillLevel: string
  sentiment: string
}

export interface ClassificationResult {
  classifications: MessageClassification[]
  model: string
  totalMessages: number
  inputTokens: number
  outputTokens: number
  costUSD: number
}

export interface CostEstimate {
  messageCount: number
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostUSD: number
}

// ─── Constants ──────────────────────────────────────────────────────

const MODEL = 'gpt-4.1-mini'

// gpt-4.1-mini pricing (per 1M tokens)
const INPUT_PRICE_PER_M = 0.40
const OUTPUT_PRICE_PER_M = 1.60

const SYSTEM_PROMPT = `You are a message classifier for software development conversations. Given user messages from an AI coding agent session (e.g., Claude Code, Codex), classify each on these dimensions:

1. **message_type**: One of:
   - instruction: Direct command to do something ("add a button", "fix the bug", "deploy")
   - question: Asking for information or explanation ("how does X work?", "what's wrong?")
   - feedback: Reacting to agent output ("looks good", "no that's wrong", "yes")
   - context: Providing background info, pasting errors, sharing URLs/specs
   - navigation: File/code navigation ("show me the file", "read X", "search for Y")
   - meta: About the conversation itself ("let's move on", "forget that", "start over")

2. **role**: What professional role this message implies:
   - product_ux: UI/UX decisions, user flows, design choices, layout
   - architect: System design, tech stack, data modeling, API design
   - frontend_dev: UI components, styling, client-side code
   - backend_dev: API routes, server logic, database queries, auth
   - data_engineer: Data pipelines, parsing, ETL, batch processing
   - domain_expert: Domain-specific knowledge, business rules
   - qa_tester: Testing, validation, edge cases, bug reports
   - devops: Deployment, CI/CD, environment config, hosting
   - project_manager: Planning, priorities, scope, task management

3. **skill_level**: Technical skill needed to formulate this message:
   - non_technical: Anyone could say this, no programming knowledge needed
   - junior: Basic programming concepts, simple instructions
   - mid: Working knowledge of frameworks and tools
   - senior: Deep implementation details, debugging, architecture trade-offs
   - expert: Cutting-edge technical or deep domain expertise

4. **sentiment**: Emotional tone:
   - neutral: Matter-of-fact
   - positive: Satisfied, excited, appreciative
   - frustrated: Annoyed, impatient, something isn't working
   - exploratory: Curious, brainstorming, trying things out

You will receive a numbered list of user messages, each possibly with assistant context.
Respond with ONLY a JSON array of objects in the same order, no explanation:
[{"message_type": "...", "role": "...", "skill_level": "...", "sentiment": "..."}, ...]`

// ─── Helpers ────────────────────────────────────────────────────────

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2)
  return text.slice(0, half) + ' ... ' + text.slice(-half)
}

interface UserMessageWithContext {
  index: number
  text: string
  assistantContext: string
  preview: string
}

/**
 * Extract user messages from a chat log with preceding assistant context.
 */
export function extractUserMessages(chatLog: ChatMessage[]): UserMessageWithContext[] {
  const messages: UserMessageWithContext[] = []
  let lastAssistantText = ''

  for (const msg of chatLog) {
    if (msg.role === 'assistant' && !msg.isThinking && !msg.toolName) {
      lastAssistantText = msg.content
    } else if (msg.role === 'user') {
      const text = msg.content.trim()
      if (!text || text.length < 3) continue

      messages.push({
        index: msg.stepIndex,
        text: text.length > 1500 ? text.slice(0, 1500) + '... [truncated]' : text,
        assistantContext: lastAssistantText
          ? truncateText(lastAssistantText, 2000)
          : '',
        preview: text.slice(0, 80),
      })
    }
  }

  return messages
}

/**
 * Estimate the cost of classifying messages without making an API call.
 */
export function estimateCost(messages: UserMessageWithContext[]): CostEstimate {
  const systemChars = SYSTEM_PROMPT.length
  let userChars = 0

  for (const msg of messages) {
    userChars += msg.text.length
    if (msg.assistantContext) {
      userChars += msg.assistantContext.length + 30 // "[Previous assistant message: ]\n\n"
    }
    userChars += 20 // numbering overhead
  }

  // Rough token estimate: ~4 chars per token
  const inputTokens = Math.ceil((systemChars + userChars) / 4)
  // ~50 output tokens per message (JSON classification)
  const outputTokens = messages.length * 50

  const costUSD =
    (inputTokens / 1_000_000) * INPUT_PRICE_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M

  return {
    messageCount: messages.length,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCostUSD: costUSD,
  }
}

/**
 * Build the user prompt content for a batch of messages.
 */
function buildBatchPrompt(messages: UserMessageWithContext[]): string {
  return messages
    .map((msg, i) => {
      const parts: string[] = [`${i + 1}.`]
      if (msg.assistantContext) {
        parts.push(`[Previous assistant message: ${msg.assistantContext}]`)
      }
      parts.push(`User message: ${msg.text}`)
      return parts.join('\n')
    })
    .join('\n\n')
}

// Max messages per API call to stay within context limits
const BATCH_SIZE = 20

/**
 * Classify user messages by calling the OpenAI API.
 * Batches messages to reduce API calls.
 */
export async function classifyMessages(
  apiKey: string,
  messages: UserMessageWithContext[]
): Promise<ClassificationResult> {
  const client = new OpenAI({ apiKey })

  const classifications: MessageClassification[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Process in batches
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    const userContent = buildBatchPrompt(batch)

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.0,
      response_format: { type: 'json_object' },
    })

    const choice = response.choices[0]
    const content = choice?.message?.content || '[]'

    totalInputTokens += response.usage?.prompt_tokens || 0
    totalOutputTokens += response.usage?.completion_tokens || 0

    // Parse response — could be a JSON array or an object with an array
    let parsed: Array<{
      message_type?: string
      role?: string
      skill_level?: string
      sentiment?: string
    }>
    try {
      const raw = JSON.parse(content)
      parsed = Array.isArray(raw) ? raw : raw.classifications || raw.results || Object.values(raw)[0] || []
      if (!Array.isArray(parsed)) parsed = [parsed]
    } catch {
      // If parsing fails, skip this batch
      continue
    }

    for (let j = 0; j < batch.length; j++) {
      const msg = batch[j]
      const cls = parsed[j] || {}
      classifications.push({
        messageIndex: msg.index,
        messagePreview: msg.preview,
        messageType: cls.message_type || 'unknown',
        role: cls.role || 'unknown',
        skillLevel: cls.skill_level || 'unknown',
        sentiment: cls.sentiment || 'unknown',
      })
    }
  }

  const costUSD =
    (totalInputTokens / 1_000_000) * INPUT_PRICE_PER_M +
    (totalOutputTokens / 1_000_000) * OUTPUT_PRICE_PER_M

  return {
    classifications,
    model: MODEL,
    totalMessages: messages.length,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUSD,
  }
}
