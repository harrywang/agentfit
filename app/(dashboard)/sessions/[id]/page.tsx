'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Clock, Coins, MessageSquare, Wrench, CheckCircle, XCircle } from 'lucide-react'
import { SessionWorkflow } from '@/components/session-workflow'
import { SessionChatLog } from '@/components/session-chatlog'
import type { SessionDetail } from '@/lib/session-detail'

export default function SessionDetailPage() {
  const params = useParams()
  const sessionId = params.id as string
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'workflow' | 'dialog'>('dialog')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/session?id=${sessionId}`)
        if (!res.ok) throw new Error('Session not found')
        const data = await res.json()
        setDetail(data)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  if (loading) {
    return <div className="text-muted-foreground">Loading session...</div>
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link href="/sessions" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sessions
        </Link>
        <div className="text-destructive">{error || 'Session not found'}</div>
      </div>
    )
  }

  const s = detail.stats

  return (
    <div className="space-y-4">
      <Link href="/sessions" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to sessions
      </Link>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{s.duration}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tokens</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{s.tokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{s.totalMessages}</div>
            <p className="text-xs text-muted-foreground">{s.userTurns} user / {s.assistantTurns} assistant</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tool Calls</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{s.toolCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{s.successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failures</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tracking-tight ${s.failureCount > 0 ? 'text-destructive' : ''}`}>{s.failureCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1.5 border-b pb-1">
        <button
          onClick={() => setActiveTab('dialog')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'dialog'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Dialog
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'workflow'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Workflow
        </button>
      </div>

      {activeTab === 'dialog' && (
        <Card>
          <CardHeader>
            <CardTitle>Chat Log</CardTitle>
            <CardDescription>{detail.chatLog.length} records</CardDescription>
          </CardHeader>
          <CardContent>
            <SessionChatLog messages={detail.chatLog} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'workflow' && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
            <CardDescription>
              Tool calls, reasoning, and execution flow — {detail.workflowNodes.length} nodes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SessionWorkflow nodes={detail.workflowNodes} edges={detail.workflowEdges} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
