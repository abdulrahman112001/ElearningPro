import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Loading placeholders that mirror the real building blocks, so pages
 * don't jump when data arrives. Use them in loading.tsx files and
 * Suspense fallbacks.
 */

/** Mirrors <StatCard>. */
export function StatSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-soft sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  )
}

/** A row of StatSkeletons in the standard responsive stats grid. */
export function StatGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <StatSkeleton key={i} />
      ))}
    </div>
  )
}

/** Mirrors a course/media card: optional cover image, title, meta lines. */
export function CardSkeleton({
  withImage = true,
  className,
}: {
  withImage?: boolean
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card shadow-soft", className)}>
      {withImage && <Skeleton className="aspect-video w-full rounded-none" />}
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  )
}

/** Mirrors a table inside a SectionCard. */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card shadow-soft", className)}>
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "w-1/3" : "flex-1")} />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex w-1/3 items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
            {Array.from({ length: Math.max(columns - 1, 0) }).map((_, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors a list of AvatarName rows (messages, students, activity). */
export function ListSkeleton({
  rows = 5,
  className,
  withAction = false,
}: {
  rows?: number
  className?: string
  withAction?: boolean
}) {
  return (
    <div className={cn("divide-y rounded-lg border bg-card shadow-soft", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {withAction && <Skeleton className="h-8 w-16 rounded-md" />}
        </div>
      ))}
    </div>
  )
}

/** Mirrors <PageHeader>. */
export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mb-6 flex items-start gap-4 sm:mb-8", className)}>
      <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
    </div>
  )
}
