// ─── Slash Command Usage Analysis ────────────────────────────────────
// Parses ~/.claude/history.jsonl to extract slash command usage patterns
// and compares against the full set of built-in Claude Code commands.

import fs from 'fs'
import path from 'path'
import os from 'os'

// ─── Types ───────────────────────────────────────────────────────────

export interface CommandInfo {
  command: string
  description: string
  category: string
  aliases?: string[]
}

export interface CommandUsage {
  command: string
  description: string
  category: string
  count: number
  used: boolean
  aliases?: string[]
}

export interface CommandAnalysis {
  totalCommands: number
  usedCommands: number
  unusedCommands: number
  usagePercentage: number
  totalInvocations: number
  commands: CommandUsage[]
  categories: Record<string, { total: number; used: number; invocations: number }>
  customCommands: { command: string; count: number }[]
}

// ─── Built-in Commands Registry ──────────────────────────────────────

// Source: https://code.claude.com/docs/en/commands (official documentation)
const BUILTIN_COMMANDS: CommandInfo[] = [
  // Core — conversation lifecycle
  { command: '/help', description: 'Show help and available commands', category: 'Core' },
  { command: '/clear', description: 'Clear conversation history and free up context', category: 'Core', aliases: ['/reset', '/new'] },
  { command: '/compact', description: 'Compact conversation with optional focus instructions', category: 'Core' },
  { command: '/rewind', description: 'Rewind conversation and/or code to a previous point', category: 'Core', aliases: ['/checkpoint'] },
  { command: '/rename', description: 'Rename the current session', category: 'Core' },
  { command: '/exit', description: 'Exit the CLI', category: 'Core', aliases: ['/quit'] },

  // Session & History
  { command: '/branch', description: 'Create a branch of the current conversation at this point', category: 'Session', aliases: ['/fork'] },
  { command: '/resume', description: 'Resume a conversation by ID or name, or open session picker', category: 'Session', aliases: ['/continue'] },
  { command: '/export', description: 'Export the current conversation as plain text', category: 'Session' },

  // Configuration & Preferences
  { command: '/config', description: 'Open Settings interface for theme, model, output style, and preferences', category: 'Configuration', aliases: ['/settings'] },
  { command: '/status', description: 'Show version, model, account, and connectivity info', category: 'Configuration' },
  { command: '/theme', description: 'Change color theme (light, dark, colorblind-accessible, ANSI)', category: 'Configuration' },
  { command: '/color', description: 'Set prompt bar color for the current session', category: 'Configuration' },
  { command: '/model', description: 'Select or change the AI model', category: 'Configuration' },
  { command: '/effort', description: 'Set model effort level (low/medium/high/max/auto)', category: 'Configuration' },
  { command: '/fast', description: 'Toggle fast mode on or off', category: 'Configuration' },
  { command: '/vim', description: 'Toggle between Vim and Normal editing modes', category: 'Configuration' },
  { command: '/voice', description: 'Toggle push-to-talk voice dictation', category: 'Configuration' },
  { command: '/statusline', description: 'Configure Claude Code status line display', category: 'Configuration' },
  { command: '/terminal-setup', description: 'Configure terminal keybindings (Shift+Enter, etc.)', category: 'Configuration' },

  // Account & Billing
  { command: '/login', description: 'Sign in to your Anthropic account', category: 'Account' },
  { command: '/logout', description: 'Sign out from your Anthropic account', category: 'Account' },
  { command: '/usage', description: 'Show plan usage limits and rate limit status', category: 'Account' },
  { command: '/cost', description: 'Show token usage statistics for current session', category: 'Account' },
  { command: '/upgrade', description: 'Open upgrade page to switch to a higher plan tier', category: 'Account' },
  { command: '/passes', description: 'Share a free week of Claude Code with friends', category: 'Account' },
  { command: '/privacy-settings', description: 'View and update privacy settings (Pro/Max only)', category: 'Account' },
  { command: '/extra-usage', description: 'Configure extra usage when rate limits are hit', category: 'Account' },

  // Development Tools
  { command: '/init', description: 'Initialize project with a CLAUDE.md guide', category: 'Dev Tools' },
  { command: '/doctor', description: 'Diagnose and verify your Claude Code installation', category: 'Dev Tools' },
  { command: '/diff', description: 'Interactive diff viewer for uncommitted changes and per-turn diffs', category: 'Dev Tools' },
  { command: '/context', description: 'Visualize current context usage as a colored grid', category: 'Dev Tools' },
  { command: '/copy', description: 'Copy last assistant response to clipboard (interactive picker for code blocks)', category: 'Dev Tools' },
  { command: '/plan', description: 'Enter plan mode directly from the prompt', category: 'Dev Tools' },
  { command: '/btw', description: 'Ask a quick side question without adding to conversation', category: 'Dev Tools' },
  { command: '/sandbox', description: 'Toggle sandbox mode on supported platforms', category: 'Dev Tools' },

  // Code Review & Security
  { command: '/security-review', description: 'Analyze pending changes for security vulnerabilities', category: 'Code Review' },
  { command: '/review', description: 'Deprecated — install code-review plugin instead', category: 'Code Review' },
  { command: '/pr-comments', description: 'Fetch and display comments from a GitHub pull request', category: 'Code Review' },

  // Skills & Extensions
  { command: '/skills', description: 'List available skills', category: 'Extensions' },
  { command: '/agents', description: 'Manage agent configurations', category: 'Extensions' },
  { command: '/plugin', description: 'Manage Claude Code plugins', category: 'Extensions' },
  { command: '/reload-plugins', description: 'Reload all active plugins to apply pending changes', category: 'Extensions' },

  // Memory, Permissions & Config
  { command: '/memory', description: 'Edit CLAUDE.md memory files, enable/disable auto-memory', category: 'Memory' },
  { command: '/add-dir', description: 'Add a new working directory to the current session', category: 'Memory' },
  { command: '/keybindings', description: 'Open or create your keybindings configuration file', category: 'Memory' },
  { command: '/permissions', description: 'View or update tool permissions', category: 'Memory', aliases: ['/allowed-tools'] },
  { command: '/hooks', description: 'View hook configurations for tool events', category: 'Memory' },

  // Integrations
  { command: '/mcp', description: 'Manage MCP server connections and OAuth authentication', category: 'Integrations' },
  { command: '/ide', description: 'Manage IDE integrations and show status', category: 'Integrations' },
  { command: '/install-slack-app', description: 'Install the Claude Slack app via OAuth flow', category: 'Integrations' },
  { command: '/install-github-app', description: 'Set up Claude GitHub Actions app for a repository', category: 'Integrations' },
  { command: '/chrome', description: 'Configure Claude in Chrome settings', category: 'Integrations' },
  { command: '/remote-control', description: 'Make this session available for remote control from claude.ai', category: 'Integrations', aliases: ['/rc'] },

  // Utilities & Info
  { command: '/feedback', description: 'Submit feedback about Claude Code', category: 'Utilities', aliases: ['/bug'] },
  { command: '/tasks', description: 'List and manage background tasks', category: 'Utilities' },
  { command: '/stats', description: 'Visualize daily usage, session history, streaks, and model preferences', category: 'Utilities' },
  { command: '/insights', description: 'Generate a report analyzing your Claude Code sessions', category: 'Utilities' },
  { command: '/release-notes', description: 'View the full changelog', category: 'Utilities' },
  { command: '/mobile', description: 'Show QR code to download the Claude mobile app', category: 'Utilities', aliases: ['/ios', '/android'] },
  { command: '/desktop', description: 'Continue the current session in Claude Code Desktop app', category: 'Utilities', aliases: ['/app'] },
  { command: '/stickers', description: 'Order Claude Code stickers', category: 'Utilities' },

  // Cloud & Remote
  { command: '/schedule', description: 'Create, update, list, or run Cloud scheduled tasks', category: 'Cloud' },
  { command: '/remote-env', description: 'Configure default remote environment for web sessions', category: 'Cloud' },
]

// ─── History Parsing ─────────────────────────────────────────────────

interface HistoryEntry {
  display: string
  timestamp: number
  project?: string
  sessionId?: string
}

function parseHistory(): Map<string, number> {
  const historyPath = path.join(os.homedir(), '.claude', 'history.jsonl')
  const counts = new Map<string, number>()

  if (!fs.existsSync(historyPath)) return counts

  const content = fs.readFileSync(historyPath, 'utf-8')
  const lines = content.trim().split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const entry: HistoryEntry = JSON.parse(line)
      const text = entry.display?.trim() || ''
      const match = text.match(/^\/([a-zA-Z_-]+)/)
      if (match) {
        const cmd = '/' + match[1]
        counts.set(cmd, (counts.get(cmd) || 0) + 1)
      }
    } catch {
      continue
    }
  }

  return counts
}

// ─── Main Analysis ───────────────────────────────────────────────────

export function analyzeCommands(): CommandAnalysis {
  const usageCounts = parseHistory()

  // Build alias-to-primary map
  const aliasMap = new Map<string, string>()
  for (const cmd of BUILTIN_COMMANDS) {
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        aliasMap.set(alias, cmd.command)
      }
    }
  }

  // Merge alias counts into primary commands
  const mergedCounts = new Map<string, number>()
  for (const [cmd, count] of usageCounts) {
    const primary = aliasMap.get(cmd) || cmd
    mergedCounts.set(primary, (mergedCounts.get(primary) || 0) + count)
  }

  // Build command usage list
  const builtinSet = new Set(BUILTIN_COMMANDS.map(c => c.command))
  const commands: CommandUsage[] = BUILTIN_COMMANDS.map(cmd => ({
    command: cmd.command,
    description: cmd.description,
    category: cmd.category,
    count: mergedCounts.get(cmd.command) || 0,
    used: (mergedCounts.get(cmd.command) || 0) > 0,
    aliases: cmd.aliases,
  }))

  // Sort: used commands first (by count desc), then unused (alphabetical)
  commands.sort((a, b) => {
    if (a.used && !b.used) return -1
    if (!a.used && b.used) return 1
    if (a.used && b.used) return b.count - a.count
    return a.command.localeCompare(b.command)
  })

  // Identify custom (non-built-in) commands
  const customCommands: { command: string; count: number }[] = []
  for (const [cmd, count] of mergedCounts) {
    if (!builtinSet.has(cmd) && !aliasMap.has(cmd)) {
      customCommands.push({ command: cmd, count })
    }
  }
  customCommands.sort((a, b) => b.count - a.count)

  // Category stats
  const categories: Record<string, { total: number; used: number; invocations: number }> = {}
  for (const cmd of commands) {
    if (!categories[cmd.category]) {
      categories[cmd.category] = { total: 0, used: 0, invocations: 0 }
    }
    categories[cmd.category].total++
    if (cmd.used) categories[cmd.category].used++
    categories[cmd.category].invocations += cmd.count
  }

  const usedCommands = commands.filter(c => c.used).length
  const totalInvocations = commands.reduce((sum, c) => sum + c.count, 0)

  return {
    totalCommands: BUILTIN_COMMANDS.length,
    usedCommands,
    unusedCommands: BUILTIN_COMMANDS.length - usedCommands,
    usagePercentage: Math.round((usedCommands / BUILTIN_COMMANDS.length) * 100),
    totalInvocations,
    commands,
    categories,
    customCommands,
  }
}
