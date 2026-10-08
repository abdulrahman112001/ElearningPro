import * as React from "react"
import { TrendingDown, TrendingUp, Minus, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { toneStyles, type Tone } from "./tones"

export interface StatCardProps {
  label: React.ReactNode
  /** Pre-formatted value (use formatPrice / Intl.NumberFormat upstream) */
  value: React.ReactNode
  icon?: LucideIcon
  tone?: Exclude<Tone, "neutral">
  /**
   * Change vs. previous period. A number is rendered as a signed percent
   * (12 -> "+12%"); a string is rendered as-is. Sign decides the colour.
   */
  delta?: number | string
  /** Set to true when a negative delta is good (e.g. refunds went down) */
  invertDelta?: boolean
  /** Small caption under the value, e.g. "this month" */
  hint?: React.ReactNode
  className?: string
}

/**
 * KPI tile for dashboards. Values use tabular numbers so rows of stats
 * line up. Works in server and client components.
 *
 * @example
 * <StatCard label={t("students")} value="1,240" icon={Users} tone="info" delta={8.2} hint={t("vsLastMonth")} />
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  delta,
  invertDelta = false,
  hint,
  className,
}: StatCardProps) {
  let direction: "up" | "down" | "flat" | null = null
  let deltaText: string | null = null
  if (typeof delta === "number") {
    direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
    const rounded = Math.round(Math.abs(delta) * 10) / 10
    deltaText = `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${rounded}%`
  } else if (typeof delta === "string" && delta.length > 0) {
    const trimmed = delta.trim()
    direction = trimmed.startsWith("-") ? "down" : trimmed.startsWith("+") ? "up" : "flat"
    deltaText = trimmed
  }
  const positive = direction === "up" ? !invertDelta : direction === "down" ? invertDelta : null
  const TrendIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-4 text-card-foreground shadow-soft transition-shadow hover:shadow-elevated sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md sm:h-10 sm:w-10",
              toneStyles[tone].icon
            )}
          >
            <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </div>
        )}
      </div>

      <p className="mt-2 text-2xl font-bold tabular-nums leading-none tracking-normal sm:text-[1.75rem]">
        {value}
      </p>

      {(deltaText || hint) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {deltaText && (
            <span
              dir="ltr"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold tabular-nums",
                positive === true && "bg-success/10 text-success",
                positive === false && "bg-destructive/10 text-destructive",
                positive === null && "bg-muted text-muted-foreground"
              )}
            >
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              {deltaText}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  )
}
