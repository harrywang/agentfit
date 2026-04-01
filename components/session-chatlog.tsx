'use client'

import { useState } from 'react'
import { User, Brain, Wrench, CheckCircle, XCircle, Settings, ChevronDown, ChevronRight, Image } from 'lucide-react'
import type { ChatMessage } from '@/lib/session-detail'

const ROLE_CONFIG: Record<string, { color: string; bg: string; icon: typeof User; label: string }> = {
  user:        { color: '#3b82f6', bg: '#eff6ff', icon: User, label: 'User Input' },
  assistant:   { color: '#8b5cf6', bg: '#faf5ff', icon: Brain, label: 'Assistant' },
  tool_result: { color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle, label: 'Tool Result' },
  system:      { color: '#94a3b8', bg: '#f8fafc', icon: Settings, label: 'System' },
}

function ChatEntry({ message, index }: { message: ChatMessage; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const config = ROLE_CONFIG[message.role] || ROLE_CONFIG.system
  const Icon = message.toolName ? Wrench : (message.isThinking ? Brain : config.icon)
  const isLong = message.content.length > 150

  let label = config.label
  if (message.toolName) label = message.toolName
  else if (message.isThinking) label = 'Thinking'
  else if (message.role === 'tool_result' && message.content.includes('error')) {
    label = 'Error'
  }

  return (
    <div
      className="flex gap-3 py-2"
      style={{ borderLeft: `3px solid ${config.color}`, paddingLeft: 12 }}
    >
      <div className="shrink-0 mt-0.5">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: config.bg }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold" style={{ color: config.color }}>
            #{message.stepIndex} {label}
          </span>
          {message.isSidechain && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">sub-agent</span>
          )}
          {message.images && message.images > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Image className="h-3 w-3" /> {message.images}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
          </span>
        </div>
        <div
          className={`text-xs leading-relaxed text-foreground/80 ${
            !expanded && isLong ? 'line-clamp-3' : ''
          }`}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {message.content}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 mt-1 text-[11px] text-primary hover:underline"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  )
}

export function SessionChatLog({ messages }: { messages: ChatMessage[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? messages
    : messages.filter(m => m.role === filter || (filter === 'tool' && (m.toolName || m.role === 'tool_result')))

  return (
    <div className="space-y-2">
      {/* Filter buttons */}
      <div className="flex gap-1.5 pb-2 border-b">
        {[
          { key: 'all', label: 'All', count: messages.length },
          { key: 'user', label: 'User', count: messages.filter(m => m.role === 'user').length },
          { key: 'assistant', label: 'Assistant', count: messages.filter(m => m.role === 'assistant' && !m.toolName).length },
          { key: 'tool', label: 'Tools', count: messages.filter(m => m.toolName || m.role === 'tool_result').length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="space-y-0.5 max-h-[600px] overflow-y-auto pr-2">
        {filtered.map((msg, i) => (
          <ChatEntry key={msg.id} message={msg} index={i} />
        ))}
      </div>

      {messages.length > 200 && (
        <div className="text-xs text-muted-foreground text-center pt-2">
          Showing {filtered.length} of {messages.length} messages
        </div>
      )}
    </div>
  )
}
