'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PaginationState } from '@/hooks/use-pagination'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function PaginationControls<T>({
  pagination,
  showPageSize = true,
  noun = 'items',
}: {
  pagination: PaginationState<T>
  showPageSize?: boolean
  noun?: string
}) {
  const { page, totalPages, totalItems, canPrevious, canNext, previous, next, setPage, setPageSize, pageSize, startIndex, endIndex } = pagination

  if (totalItems === 0) return null

  // Build page numbers to show
  const pages: (number | 'ellipsis')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('ellipsis')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="text-xs text-muted-foreground">
        {startIndex}–{endIndex} of {totalItems} {noun}
      </div>
      <div className="flex items-center gap-1.5">
        {showPageSize && (
          <Select
            value={String(pageSize)}
            onValueChange={(v) => v && setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={previous}
          disabled={!canPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8 text-xs"
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={next}
          disabled={!canNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
