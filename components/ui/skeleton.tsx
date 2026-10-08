import * as React from "react"
import { cn } from "@/lib/utils"

/** shadcn-style loading placeholder. Size it with utility classes. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
