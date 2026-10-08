import * as React from "react"
import { cn } from "@/lib/utils"
import { toneStyles, type Tone } from "./tones"

export interface ScoreBarProps {
  /** Current value (e.g. score or completed lessons) */
  value: number
  /** Maximum value, default 100 */
  max?: number
  /** Text shown at the inline-start above the bar */
  label?: React.ReactNode
  /** Show the percentage at the inline-end (default true) */
  showValue?: boolean
  /** Custom value text, e.g. "7 / 10" */
  valueLabel?: React.ReactNode
  /** Force a tone; otherwise derived from the percentage via thresholds */
  tone?: Tone
  /** Percent thresholds: >= good -> success, >= fair -> warning, else danger */
  thresholds?: { good: number; fair: number }
  /** Plain brand colour instead of value-based tones (for course progress) */
  neutralTone?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

/** Pick a tone for a percentage. Exported for tables that colour text. */
export function scoreTone(
  percent: number,
  thresholds: { good: number; fair: number } = { good: 75, fair: 50 }
): Tone {
  if (percent >= thresholds.good) return "success"
  if (percent >= thresholds.fair) return "warning"
  return "danger"
}

const heights = { sm: "h-1.5", md: "h-2", lg: "h-3" } as const

/**
 * Horizontal score / progress bar. Fills from the inline-start side, so it
 * reads correctly in RTL. Exposes role="progressbar" for screen readers.
 *
 * @example
 * <ScoreBar value={attempt.score} label={student.name} />          // tone by score
 * <ScoreBar value={done} max={total} neutralTone valueLabel={`${done}/${total}`} />
 */
export function ScoreBar({
  value,
  max = 100,
  label,
  showValue = true,
  valueLabel,
  tone,
  thresholds,
  neutralTone = false,
  size = "md",
  className,
}: ScoreBarProps) {
  const safeMax = max > 0 ? max : 100
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100))
  const rounded = Math.round(percent)
  const resolved: Tone = tone ?? (neutralTone ? "primary" : scoreTone(percent, thresholds))

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {label ? <span className="min-w-0 truncate text-muted-foreground">{label}</span> : <span />}
          {showValue && (
            <span className={cn("shrink-0 font-semibold tabular-nums", toneStyles[resolved].text)}>
              {valueLabel ?? `${rounded}%`}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={value}
        className={cn("w-full overflow-hidden rounded-full bg-muted", heights[size])}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            toneStyles[resolved].solid
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
