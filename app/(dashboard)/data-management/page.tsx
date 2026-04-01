'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/components/data-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Database,
  HardDrive,
  FolderSync,
} from 'lucide-react'
import { BackupCard } from '@/components/backup-section'

export default function SettingsPage() {
  const { syncing, resetting, lastSyncResult, lastSyncTime, handleSync, handleReset } = useData()
  const [resetOpen, setResetOpen] = useState(false)
  const [paths, setPaths] = useState<{ database: string; images: string; claudeLogs: string; codexLogs: string } | null>(null)

  useEffect(() => {
    fetch('/api/check')
      .then((r) => r.json())
      .then((d) => { if (d.paths) setPaths(d.paths) })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Local Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Local Data</CardTitle>
              <CardDescription>Manage your synced session data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FolderSync className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sync Logs</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Import new sessions from ~/.claude and ~/.codex into the local database.
              </p>
              {lastSyncTime && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {lastSyncTime.toLocaleString()}
                  {lastSyncResult && (
                    <span> — {lastSyncResult.sessionsAdded} added, {lastSyncResult.sessionsSkipped} skipped</span>
                  )}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing || resetting}
              className="gap-2 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </Button>
          </div>

          {/* Reset */}
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Reset Database</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Delete all synced data and re-import from log files on disk. Use if data seems corrupted.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setResetOpen(true)}
              disabled={syncing || resetting}
              className="gap-2 shrink-0"
            >
              <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
              {resetting ? 'Resetting...' : 'Reset'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Storage</CardTitle>
              <CardDescription>Where your data lives</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs">{paths?.database ?? 'agentfit.db'}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Claude Code logs</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs">{paths?.claudeLogs ?? '~/.claude/projects/'}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Codex logs</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs">{paths?.codexLogs ?? '~/.codex/sessions/'}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Extracted images</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs">{paths?.images ?? 'data/images/'}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Backup */}
      <BackupCard />

      {/* Reset confirmation dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Destructive Action
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              This will <strong className="text-foreground">permanently delete all synced data</strong> from the database and re-import from log files currently on disk.
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <strong>Warning:</strong> If your coding agent (Claude Code, Codex, etc.) has purged old log files, that data will be permanently lost. The database may contain sessions that no longer exist on disk.
            </div>
            <div>
              This cannot be undone. Consider backing up <code className="rounded bg-muted px-1 py-0.5 text-xs">agentfit.db</code> first.
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={resetting}
              onClick={async () => {
                await handleReset()
                setResetOpen(false)
              }}
            >
              I understand, reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
