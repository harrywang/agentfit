import fs from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from './db'
import { loadPricing, calculateCost, type ModelPricing } from './pricing'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')
const IMAGES_DIR = path.resolve(process.cwd(), 'data', 'images')

interface LogEntry {
  type?: string
  uuid?: string
  version?: string
  message?: {
    role?: string
    content?: unknown[]
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
  timestamp?: string
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
        inputTokens += u.input_tokens || 0
        outputTokens += u.output_tokens || 0
        cacheCreationTokens += u.cache_creation_input_tokens || 0
        cacheReadTokens += u.cache_read_input_tokens || 0
        if (currentModel) {
          costUSD += calculateCost(currentModel, u, allPricing)
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

  // Get all existing sessionIds to skip
  const existing = await prisma.session.findMany({ select: { sessionId: true } })
  const existingIds = new Set(existing.map((s) => s.sessionId))

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

    let jsonlFiles: string[]
    try {
      jsonlFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'))
    } catch {
      continue
    }

    for (const file of jsonlFiles) {
      result.filesProcessed++
      const sessionId = path.basename(file, '.jsonl')

      if (existingIds.has(sessionId)) {
        result.sessionsSkipped++
        continue
      }

      try {
        const parsed = parseSessionFile(path.join(dirPath, file), sessionId, allPricing)
        if (!parsed) {
          result.sessionsSkipped++
          continue
        }

        await prisma.session.create({
          data: {
            sessionId,
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
          },
        })

        // Insert image records
        for (const img of parsed.images) {
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
        }

        result.sessionsAdded++
      } catch {
        result.errors++
      }
    }
  }

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
