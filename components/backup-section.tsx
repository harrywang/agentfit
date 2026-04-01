'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Cloud,
  CloudOff,
  Check,
  Loader2,
  Upload,
} from 'lucide-react'

interface FolderStatus {
  exists: boolean
  hasGit: boolean
  hasRemote: boolean
  isDirty: boolean
}

interface BackupStatus {
  ghInstalled: boolean
  ghAuthenticated: boolean
  ghUser: string
  claude: FolderStatus
  codex: FolderStatus
}

export function BackupCard() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backup')
      setStatus(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleInit = async (folder: 'claude' | 'codex') => {
    setSyncing((s) => ({ ...s, [folder]: true }))
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', folder }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Backup failed', { description: data.error })
        return
      }
      toast.success(`~/.${folder} backed up`, {
        description: (
          <a href={data.repoUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {data.repoUrl}
          </a>
        ),
      })
      await fetchStatus()
    } catch (e) {
      toast.error('Backup failed', { description: (e as Error).message })
    } finally {
      setSyncing((s) => ({ ...s, [folder]: false }))
    }
  }

  const handleSync = async (folder: 'claude' | 'codex') => {
    setSyncing((s) => ({ ...s, [folder]: true }))
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', folder }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Sync failed', { description: data.error })
        return
      }
      toast.success(`~/.${folder} synced`, { description: data.message })
      await fetchStatus()
    } catch (e) {
      toast.error('Sync failed', { description: (e as Error).message })
    } finally {
      setSyncing((s) => ({ ...s, [folder]: false }))
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>GitHub Backup</CardTitle>
              <CardDescription>Checking GitHub status...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status || !status.ghInstalled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>GitHub Backup</CardTitle>
              <CardDescription>Back up your agent logs to a private GitHub repo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>GitHub CLI is not installed.</p>
            <a href="https://cli.github.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Install GitHub CLI
            </a>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status.ghAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>GitHub Backup</CardTitle>
              <CardDescription>Back up your agent logs to a private GitHub repo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Not logged in to GitHub.</p>
            <code className="block rounded bg-muted px-2 py-1.5 text-xs font-mono">gh auth login</code>
          </div>
        </CardContent>
      </Card>
    )
  }

  const folders = [
    { key: 'claude' as const, label: '~/.claude', status: status.claude },
    { key: 'codex' as const, label: '~/.codex', status: status.codex },
  ].filter((f) => f.status.exists)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>GitHub Backup</CardTitle>
            <CardDescription>
              Back up agent logs to private GitHub repos — logged in as <strong>{status.ghUser}</strong>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {folders.map(({ key, label, status: fs }) => {
          const isSetUp = fs.hasGit && fs.hasRemote
          const isSyncing = syncing[key]

          return (
            <div key={key} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <code className="text-sm font-medium">{label}</code>
                {isSetUp && !fs.isDirty && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {isSetUp && fs.isDirty && (
                  <Badge variant="secondary" className="text-xs">new changes</Badge>
                )}
              </div>
              {!isSetUp ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInit(key)}
                  disabled={isSyncing}
                  className="gap-2"
                >
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Backup
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync(key)}
                  disabled={isSyncing}
                  className="gap-2"
                >
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                  Sync
                </Button>
              )}
            </div>
          )
        })}
        {folders.length === 0 && (
          <p className="text-sm text-muted-foreground">No agent log directories found.</p>
        )}
      </CardContent>
    </Card>
  )
}
