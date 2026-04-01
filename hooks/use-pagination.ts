import { useState, useMemo } from 'react'

export interface PaginationState<T> {
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  pageItems: T[]
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  canPrevious: boolean
  canNext: boolean
  previous: () => void
  next: () => void
  startIndex: number
  endIndex: number
}

export function usePagination<T>(
  items: T[],
  defaultPageSize = 20
): PaginationState<T> {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(defaultPageSize)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Reset to page 1 if current page is out of bounds
  const safePage = Math.min(page, totalPages)

  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const pageItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  )

  const setPageSize = (size: number) => {
    setPageSizeState(size)
    setPage(1)
  }

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    pageItems,
    setPage,
    setPageSize,
    canPrevious: safePage > 1,
    canNext: safePage < totalPages,
    previous: () => setPage(Math.max(1, safePage - 1)),
    next: () => setPage(Math.min(totalPages, safePage + 1)),
    startIndex: startIndex + 1,
    endIndex,
  }
}
