'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { formatCost } from '@/lib/format'

interface AnalyzeConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading: boolean
  estimate: {
    sessionCount: number
    messageCount: number
    estimatedCostUSD: number
  } | null
}

export function AnalyzeConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  estimate,
}: AnalyzeConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run AI Analysis</DialogTitle>
        </DialogHeader>
        {estimate ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sessions</span>
                <span className="font-medium">{estimate.sessionCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">User messages</span>
                <span className="font-medium">{estimate.messageCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">gpt-4.1-mini</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Estimated cost</span>
                <span className="font-bold">{formatCost(estimate.estimatedCostUSD)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Each user message will be classified by type, role, skill level, and sentiment.
              Results are cached — you won&apos;t be charged again for the same session.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!estimate || loading}>
            {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Analyze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
