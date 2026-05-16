import fs from 'fs'
import os from 'os'
import path from 'path'

export type SessionSource = 'claude' | 'codex'

export interface ResolvedSession {
  source: SessionSource
  filePath: string
}

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
const CODEX_SESSIONS_DIR = path.join(CODEX_HOME, 'sessions')

export function resolveSessionFile(sessionId: string): ResolvedSession | null {
  if (sessionId.startsWith('codex-')) {
    const rawId = sessionId.slice('codex-'.length)
    const codexPath = findCodexSessionFile(rawId)
    if (codexPath) return { source: 'codex', filePath: codexPath }
    return null
  }

  const claudePath = findClaudeSessionFile(sessionId)
  if (claudePath) return { source: 'claude', filePath: claudePath }

  return null
}

export function findClaudeSessionFile(sessionId: string): string | null {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(projectsDir)) return null

  for (const dir of fs.readdirSync(projectsDir)) {
    const candidate = path.join(projectsDir, dir, `${sessionId}.jsonl`)
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

export function findCodexSessionFile(rawSessionId: string): string | null {
  if (!fs.existsSync(CODEX_SESSIONS_DIR)) return null
  return findCodexSessionFileRecursive(CODEX_SESSIONS_DIR, rawSessionId)
}

function findCodexSessionFileRecursive(dir: string, rawSessionId: string): string | null {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findCodexSessionFileRecursive(fullPath, rawSessionId)
      if (found) return found
      continue
    }

    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.jsonl') || !entry.name.startsWith('rollout-')) continue

    const basename = path.basename(entry.name, '.jsonl')
    if (basename === rawSessionId || basename.endsWith(`-${rawSessionId}`)) {
      return fullPath
    }
  }

  return null
}
