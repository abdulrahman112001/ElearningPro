import * as React from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { toneStyles, type Tone } from "./tones"

/**
 * Status -> tone map covering the Prisma enums (course, payment, withdrawal,
 * subscription, live session…) plus common UI states. Keys are normalised
 * to UPPER_SNAKE_CASE before lookup.
 */
const STATUS_TONES: Record<string, Tone> = {
  // success
  ACTIVE: "success",
  PUBLISHED: "success",
  COMPLETED: "success",
  APPROVED: "success",
  PAID: "success",
  SUCCEEDED: "success",
  VERIFIED: "success",
  PASSED: "success",
  ANSWERED: "success",
  ENROLLED: "success",
  // warning
  PENDING: "warning",
  PENDING_REVIEW: "warning",
  IN_REVIEW: "warning",
  PROCESSING: "warning",
  PAUSED: "warning",
  UNANSWERED: "warning",
  OPEN: "warning",
  // info
  SCHEDULED: "info",
  IN_PROGRESS: "info",
  UPCOMING: "info",
  TRIAL: "info",
  NEW: "info",
  // danger
  REJECTED: "danger",
  FAILED: "danger",
  CANCELLED: "danger",
  CANCELED: "danger",
  BLOCKED: "danger",
  EXPIRED: "danger",
  SUSPENDED: "danger",
  OVERDUE: "danger",
  LIVE: "danger",
  // neutral
  DRAFT: "neutral",
  ARCHIVED: "neutral",
  ENDED: "neutral",
  INACTIVE: "neutral",
  CLOSED: "neutral",
  NOT_STARTED: "neutral",
  REFUNDED: "neutral",
}

/** Statuses that have a translated label under `shared.status.*` */
const TRANSLATED = new Set(Object.keys(STATUS_TONES))

export function normalizeStatus(status: string): string {
  return status.trim().replace(/[\s-]+/g, "_").toUpperCase()
}

/** Resolve the tone for any status string (unknown -> neutral). */
export function statusTone(status: string | null | undefined): Tone {
  if (!status) return "neutral"
  return STATUS_TONES[normalizeStatus(status)] ?? "neutral"
}

export interface StatusBadgeProps {
  status: string | null | undefined
  /** Override the label (otherwise translated from shared.status.*) */
  label?: React.ReactNode
  /** Override the tone (otherwise derived from the status) */
  tone?: Tone
  /** Show a leading dot (pulses for LIVE) */
  dot?: boolean
  className?: string
}

/**
 * Pill showing a record's status with a consistent, dark-mode-safe colour.
 *
 * @example
 * <StatusBadge status={course.status} />            // "Published" in green
 * <StatusBadge status="custom" label={t("x")} tone="info" />
 */
export function StatusBadge({ status, label, tone, dot = true, className }: StatusBadgeProps) {
  const t = useTranslations("shared.status")
  const key = status ? normalizeStatus(status) : ""
  const resolvedTone = tone ?? statusTone(status)
  const text =
    label ??
    (TRANSLATED.has(key)
      ? t(key as "ACTIVE")
      : key
          .toLowerCase()
          .split("_")
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "))

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        toneStyles[resolvedTone].soft,
        className
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            toneStyles[resolvedTone].solid,
            key === "LIVE" && "animate-pulse"
          )}
        />
      )}
      {text}
    </span>
  )
}
