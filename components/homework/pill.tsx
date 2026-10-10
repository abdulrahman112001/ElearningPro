import * as React from "react"
import { cn } from "@/lib/utils"

/** Small status pill used by homework and school pages. */
export function Pill({ tone, children }: { tone: "success" | "info" | "warning" | "danger" | "neutral"; children: React.ReactNode }) {
  const styles = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    neutral: "border-border bg-muted text-muted-foreground",
  }[tone]
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", styles)}>{children}</span>
}
