import fs from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from './db'
import { loadPricing, calculateCost, type ModelPricing, type Speed } from './pricing'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')
const IMAGES_DIR = path.resolve(process.cwd(), 'data', 'images')

// Bucket per-message timestamps using the user's *local* timezone so daily
// totals match ccusage (apps/ccusage/src/_date-utils.ts:43-48). en-CA yields
// YYYY-MM-DD without zero-padding surprises.
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

interface LogEntry {
  type?: string
  uuid?: string
  version?: string
  requestId?: string
  sessionId?: string
  message?: {
    id?: string
    role?: string
    content?: unknown[]
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
      speed?: Speed
    }
  }
  timestamp?: string
}

interface MessageUsageRow {
  sessionId: string
  messageId: string
  requestId: string
  model: string
  speed: Speed
  timestamp: Date
  date: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUSD: number
}

interface ImageInfo {
  messageId: string
  filename: string
  mediaType: string
  sizeBytes: number
  timestamp: string
  role: string
}

function decodeProjectPath(dirName: string): string {
  return dirName.replace(/-/g, '/')
}

interface WalkedFile {
  absPath: string
  isSubagent: boolean
}

function walkJsonl(dir: string, projectRoot: string): WalkedFile[] {
  const out: WalkedFile[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...walkJsonl(full, projectRoot))
    } else if (e.isFile() && e.name.endsWith('.jsonl')) {
      // A file is "subagent" if it sits below the project root (not directly
      // in it). ccusage uses **/*.jsonl for the same effect.
      const isSubagent = path.dirname(full) !== projectRoot
      out.push({ absPath: full, isSubagent })
    }
  }
  return out
}

function getProjectName(projectPath: string): string {
  // The decoded path may be wrong if the actual folder name contains dashes,
  // since decodeProjectPath replaces ALL dashes with slashes.
  // Try merging trailing segments to find the real directory on disk.
  if (fs.existsSync(projectPath)) {
    return path.basename(projectPath)
  }
  const parts = projectPath.split('/')
  for (let merge = 2; merge <= Math.min(parts.length, 6); merge++) {
    const parentParts = parts.slice(0, -merge)
    const nameParts = parts.slice(-merge)
    const candidateName = nameParts.join('-')
    const candidatePath = [...parentParts, candidateName].join('/')
    if (fs.existsSync(candidatePath)) {
      return candidateName
    }
  }
  // Fallback: last segment
  return parts[parts.length - 1] || parts[parts.length - 2] || projectPath
}

function parseSessionFile(
  filePath: string,
  sessionId: string,
  allPricing: Record<string, ModelPricing>
) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')

  let userMessages = 0
  let assistantMessages = 0
  let inputTokens = 0
  let outputTokens = 0
  let cacheCreationTokens = 0
  let cacheReadTokens = 0
  let costUSD = 0
  let currentModel = '' // tracks model for cost calculation per message
  const modelCounts: Record<string, number> = {} // count messages per model
  let startTime = ''
  let endTime = ''
  const toolCalls: Record<string, number> = {}
  const images: ImageInfo[] = []
  const messageTimestamps: string[] = []
  const messageUsages: MessageUsageRow[] = []
  let apiErrors = 0
  let rateLimitErrors = 0
  let userInterruptions = 0
  const skillCalls: Record<string, number> = {}
  const permissionModes: Record<string, number> = {}
  let systemPromptEdits = 0
  let cliVersion = ''

  for (const line of lines) {
    if (!line.trim()) continue
    let entry: LogEntry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }

    if (entry.timestamp) {
      if (!startTime) startTime = entry.timestamp
      endTime = entry.timestamp
      messageTimestamps.push(entry.timestamp)
    }

    if (entry.version && !cliVersion) {
      cliVersion = entry.version
    }

    const entryType = entry.type
    const msg = entry.message

    if (entryType === 'user') {
      userMessages++
      // Track permission mode
      const pm = (entry as Record<string, unknown>).permissionMode as string | undefined
      if (pm) {
        permissionModes[pm] = (permissionModes[pm] || 0) + 1
      }
      // Detect user interruptions from tool_result content
      if (msg && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && typeof block === 'object' && 'type' in block) {
            const b = block as Record<string, unknown>
            if (b.type === 'tool_result') {
              const c = String(b.content || '')
              if (c.includes("doesn't want to proceed") || c.includes('was rejected')) {
                userInterruptions++
              }
            }
          }
        }
      }
    } else if (entryType === 'assistant' && msg) {
      assistantMessages++

      // Detect API errors from synthetic messages
      if (msg.model === '<synthetic>' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && typeof block === 'object' && 'type' in block) {
            const b = block as Record<string, unknown>
            if (b.type === 'text' && String(b.text || '').startsWith('API Error')) {
              apiErrors++
              const errText = String(b.text || '').toLowerCase()
              if (errText.includes('rate limit') || errText.includes('rate_limit') || errText.includes('429') || errText.includes('529') || errText.includes('overloaded')) {
                rateLimitErrors++
              }
            }
          }
        }
      }

      if (msg.model && msg.model !== '<synthetic>') {
        currentModel = msg.model
        modelCounts[msg.model] = (modelCounts[msg.model] || 0) + 1
      }

      if (msg.usage) {
        const u = msg.usage
        const speed: Speed = u.speed === 'fast' ? 'fast' : 'standard'
        const inT = u.input_tokens || 0
        const outT = u.output_tokens || 0
        const ccT = u.cache_creation_input_tokens || 0
        const crT = u.cache_read_input_tokens || 0
        const msgCost = currentModel ? calculateCost(currentModel, u, allPricing, speed) : 0

        inputTokens += inT
        outputTokens += outT
        cacheCreationTokens += ccT
        cacheReadTokens += crT
        costUSD += msgCost

        // Per-message row for daily aggregation. Dedup by (messageId, requestId)
        // happens at insert time via the unique index. Mirrors ccusage's
        // createUniqueHash (apps/ccusage/src/data-loader.ts:530-540).
        if (currentModel && msg.id && entry.requestId && entry.timestamp) {
          const ts = new Date(entry.timestamp)
          messageUsages.push({
            // Subagent files have filename basename "agent-<hash>" but carry
            // the parent session's sessionId on every line — use that so
            // sub-agent token usage rolls up to the parent Session row.
            sessionId: entry.sessionId || sessionId,
            messageId: msg.id,
            requestId: entry.requestId,
            model: currentModel,
            speed,
            timestamp: ts,
            date: DATE_FORMATTER.format(ts),
            inputTokens: inT,
            outputTokens: outT,
            cacheCreationTokens: ccT,
            cacheReadTokens: crT,
            costUSD: msgCost,
          })
        }
      }
    }

    // Extract tool calls and images from content blocks (both user and assistant)
    if (msg && Array.isArray(msg.content)) {
      let imageIndex = 0
      for (const block of msg.content) {
        if (!block || typeof block !== 'object' || !('type' in block)) continue
        const b = block as Record<string, unknown>

        if (b.type === 'tool_use') {
          const toolName = b.name as string
          if (toolName) {
            toolCalls[toolName] = (toolCalls[toolName] || 0) + 1
            // Track individual skill names
            if (toolName === 'Skill' && b.input && typeof b.input === 'object') {
              const skillName = (b.input as Record<string, unknown>).skill as string
              if (skillName) {
                skillCalls[skillName] = (skillCalls[skillName] || 0) + 1
              }
            }
            // Detect system prompt file edits (CLAUDE.md, AGENTS.md, agent.md)
            if ((toolName === 'Edit' || toolName === 'Write') && b.input && typeof b.input === 'object') {
              const fp = (b.input as Record<string, unknown>).file_path as string
              if (fp && /\/(CLAUDE|AGENTS|agent)\.md$/i.test(fp)) {
                systemPromptEdits++
              }
            }
          }
        }

        if (b.type === 'image') {
          const source = b.source as Record<string, unknown> | undefined
          if (source && source.type === 'base64' && source.data) {
            const data = source.data as string
            const mediaType = (source.media_type as string) || 'image/png'
            const ext = mediaType.split('/')[1] || 'png'
            const messageId = entry.uuid || `unknown-${Date.now()}`
            const filename = `${sessionId}/${messageId}_${imageIndex}.${ext}`

            // Write image file
            const imgPath = path.join(IMAGES_DIR, filename)
            const imgDir = path.dirname(imgPath)
            if (!fs.existsSync(imgDir)) {
              fs.mkdirSync(imgDir, { recursive: true })
            }

            const buffer = Buffer.from(data, 'base64')
            fs.writeFileSync(imgPath, buffer)

            images.push({
              messageId,
              filename,
              mediaType,
              sizeBytes: buffer.length,
              timestamp: entry.timestamp || startTime,
              role: msg.role || entryType || 'unknown',
            })
            imageIndex++
          }
        }
      }
    }
  }

  if (userMessages === 0 && assistantMessages === 0) return null

  const durationMinutes =
    startTime && endTime
      ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
      : 0

  return {
    startTime,
    endTime,
    durationMinutes: Math.max(0, durationMinutes),
    userMessages,
    assistantMessages,
    totalMessages: userMessages + assistantMessages,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
    costUSD,
    model: Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
    modelCounts,
    toolCalls,
    toolCallsTotal: Object.values(toolCalls).reduce((a, b) => a + b, 0),
    messageTimestamps,
    apiErrors,
    rateLimitErrors,
    userInterruptions,
    skillCalls,
    permissionModes,
    systemPromptEdits,
    cliVersion: cliVersion || 'unknown',
    images,
    messageUsages,
  }
}

export interface SyncResult {
  filesProcessed: number
  sessionsAdded: number
  sessionsSkipped: number
  imagesExtracted: number
  errors: number
}

export async function syncLogs(): Promise<SyncResult> {
  const allPricing = await loadPricing()
  const result: SyncResult = {
    filesProcessed: 0,
    sessionsAdded: 0,
    sessionsSkipped: 0,
    imagesExtracted: 0,
    errors: 0,
  }

  if (!fs.existsSync(PROJECTS_DIR)) {
    return result
  }

  // Ensure images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
  }

  // We always re-read every JSONL — Claude Code appends to the same file
  // throughout a long session, so a one-shot import would freeze the partial
  // state. Idempotency comes from the (messageId, requestId) unique index on
  // MessageUsage and from upserting Session by sessionId.
  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
    try {
      return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory()
    } catch {
      return false
    }
  })

  for (const dir of projectDirs) {
    const projectPath = decodeProjectPath(dir)
    const projectName = getProjectName(projectPath)
    const dirPath = path.join(PROJECTS_DIR, dir)

    // Recurse for *.jsonl. Top-level files are standalone conversations
    // (filename = sessionId). Files under <session>/subagents/ carry the
    // parent's sessionId on each line; we only mine them for MessageUsage.
    const jsonlFiles = walkJsonl(dirPath, dirPath)

    for (const { absPath, isSubagent } of jsonlFiles) {
      result.filesProcessed++
      const sessionId = path.basename(absPath, '.jsonl')

      try {
        const parsed = parseSessionFile(absPath, sessionId, allPricing)
        if (!parsed) {
          result.sessionsSkipped++
          continue
        }

        // Subagent files contribute MessageUsage only — the conversation
        // itself is owned by the top-level JSONL.
        if (isSubagent) {
          for (const m of parsed.messageUsages) {
            await prisma.$executeRaw`
              INSERT INTO "MessageUsage" (
                "id", "sessionId", "messageId", "requestId", "model", "speed",
                "timestamp", "date",
                "inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens",
                "costUSD", "createdAt"
              ) VALUES (
                ${`mu_${m.messageId}_${m.requestId}`}, ${m.sessionId}, ${m.messageId}, ${m.requestId},
                ${m.model}, ${m.speed},
                ${m.timestamp.toISOString()}, ${m.date},
                ${m.inputTokens}, ${m.outputTokens}, ${m.cacheCreationTokens}, ${m.cacheReadTokens},
                ${m.costUSD}, ${new Date().toISOString()}
              )
              ON CONFLICT("messageId", "requestId") DO UPDATE SET
                "costUSD" = MAX("MessageUsage"."costUSD", excluded."costUSD")
            `
          }
          result.sessionsAdded++
          continue
        }

        const sessionData = {
          project: projectName,
          projectPath,
          startTime: new Date(parsed.startTime),
          endTime: new Date(parsed.endTime),
          durationMinutes: parsed.durationMinutes,
          userMessages: parsed.userMessages,
          assistantMessages: parsed.assistantMessages,
          totalMessages: parsed.totalMessages,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          cacheCreationTokens: parsed.cacheCreationTokens,
          cacheReadTokens: parsed.cacheReadTokens,
          totalTokens: parsed.totalTokens,
          costUSD: parsed.costUSD,
          model: parsed.model,
          toolCallsTotal: parsed.toolCallsTotal,
          toolCallsJson: JSON.stringify(parsed.toolCalls),
          skillCallsJson: JSON.stringify(parsed.skillCalls),
          messageTimestamps: JSON.stringify(parsed.messageTimestamps),
          apiErrors: parsed.apiErrors,
          rateLimitErrors: parsed.rateLimitErrors,
          userInterruptions: parsed.userInterruptions,
          permissionModesJson: JSON.stringify(parsed.permissionModes),
          systemPromptEdits: parsed.systemPromptEdits,
          cliVersion: parsed.cliVersion,
          modelCountsJson: JSON.stringify(parsed.modelCounts),
        }

        await prisma.session.upsert({
          where: { sessionId },
          create: { sessionId, ...sessionData },
          update: sessionData,
        })

        // Per-message usage rows. Unique index on (messageId, requestId) makes
        // this idempotent across re-syncs and dedupes forks/resumes that copy
        // prior turns into new JSONLs. Use SQLite's INSERT OR IGNORE because
        // Prisma createMany on libsql doesn't expose skipDuplicates.
        for (const m of parsed.messageUsages) {
          await prisma.$executeRaw`
            INSERT OR IGNORE INTO "MessageUsage" (
              "id", "sessionId", "messageId", "requestId", "model", "speed",
              "timestamp", "date",
              "inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens",
              "costUSD", "createdAt"
            ) VALUES (
              ${`mu_${m.messageId}_${m.requestId}`}, ${m.sessionId}, ${m.messageId}, ${m.requestId},
              ${m.model}, ${m.speed},
              ${m.timestamp.toISOString()}, ${m.date},
              ${m.inputTokens}, ${m.outputTokens}, ${m.cacheCreationTokens}, ${m.cacheReadTokens},
              ${m.costUSD}, ${new Date().toISOString()}
            )
          `
        }

        // Insert image records
        for (const img of parsed.images) {
          try {
            await prisma.image.create({
              data: {
                sessionId,
                messageId: img.messageId,
                filename: img.filename,
                mediaType: img.mediaType,
                sizeBytes: img.sizeBytes,
                timestamp: new Date(img.timestamp),
                role: img.role,
              },
            })
            result.imagesExtracted++
          } catch {
            // Unique constraint — already imported on a prior sync.
          }
        }

        result.sessionsAdded++
      } catch {
        result.errors++
      }
    }
  }

  // Roll up sub-agent contributions into the parent Session row so per-session
  // tokens/cost reflect total work (top-level + subagents).
  await prisma.$executeRaw`
    UPDATE "Session" SET
      "inputTokens"         = COALESCE((SELECT SUM("inputTokens")         FROM "MessageUsage" mu WHERE mu."sessionId" = "Session"."sessionId"), "inputTokens"),
      "outputTokens"        = COALESCE((SELECT SUM("outputTokens")        FROM "MessageUsage" mu WHERE mu."sessionId" = "Session"."sessionId"), "outputTokens"),
      "cacheCreationTokens" = COALESCE((SELECT SUM("cacheCreationTokens") FROM "MessageUsage" mu WHERE mu."sessionId" = "Session"."sessionId"), "cacheCreationTokens"),
      "cacheReadTokens"     = COALESCE((SELECT SUM("cacheReadTokens")     FROM "MessageUsage" mu WHERE mu."sessionId" = "Session"."sessionId"), "cacheReadTokens"),
      "costUSD"             = COALESCE((SELECT SUM("costUSD")             FROM "MessageUsage" mu WHERE mu."sessionId" = "Session"."sessionId"), "costUSD"),
      "totalTokens"         = COALESCE((
        SELECT SUM("inputTokens" + "outputTokens" + "cacheCreationTokens" + "cacheReadTokens")
        FROM "MessageUsage" mu WHERE mu."sessionId" = "Session"."sessionId"
      ), "totalTokens")
  `

  // Log the sync
  await prisma.syncLog.create({
    data: {
      filesProcessed: result.filesProcessed,
      sessionsAdded: result.sessionsAdded,
      sessionsSkipped: result.sessionsSkipped,
    },
  })

  return result
}

// Lightweight check: count how many JSONL files exist on disk that aren't in the DB
export async function checkForNewSessions(): Promise<number> {
  if (!fs.existsSync(PROJECTS_DIR)) return 0

  const existing = await prisma.session.findMany({ select: { sessionId: true } })
  const existingIds = new Set(existing.map((s) => s.sessionId))

  let newCount = 0
  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
    try {
      return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory()
    } catch {
      return false
    }
  })

  for (const dir of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dir)
    let jsonlFiles: string[]
    try {
      jsonlFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'))
    } catch {
      continue
    }
    for (const file of jsonlFiles) {
      const sessionId = path.basename(file, '.jsonl')
      if (!existingIds.has(sessionId)) newCount++
    }
  }

  return newCount
}
