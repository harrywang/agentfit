// ─── User Configuration ─────────────────────────────────────────────
// Stored in ~/.agentfit/config.json — separate from DB and backups.

import fs from 'fs'
import path from 'path'
import os from 'os'

const CONFIG_DIR = path.join(os.homedir(), '.agentfit')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

interface Config {
  openaiApiKey?: string
}

export function readConfig(): Config {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {}
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

export function writeConfig(updates: Partial<Config>) {
  const current = readConfig()
  const merged = { ...current, ...updates }

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + '\n', { mode: 0o600 })
}

export function getOpenAIKey(): string | undefined {
  return readConfig().openaiApiKey
}

export function setOpenAIKey(key: string) {
  writeConfig({ openaiApiKey: key })
}

export function clearOpenAIKey() {
  writeConfig({ openaiApiKey: undefined })
}
