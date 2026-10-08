"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  Pencil,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"

type StepState = "done" | "current" | "upcoming"

/** Horizontal on desktop, vertical on phones. */
export function ApplicationTimeline({ states }: { states: [StepState, StepState, StepState, StepState] }) {
  const t = useTranslations("instructorApplication.timeline")
  const steps = [
    { key: "account", label: t("account") },
    { key: "submitted", label: t("submitted") },
    { key: "review", label: t("review") },
    { key: "teaching", label: t("teaching") },
  ]
  return (
    <ol className="grid gap-4 sm:grid-cols-4 sm:gap-2" aria-label={t("label")}>
      {steps.map((step, i) => {
        const state = states[i]
        return (
          <li
            key={step.key}
            className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
            aria-current={state === "current" ? "step" : undefined}
          >
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute start-4 top-9 h-[calc(100%-1.5rem)] w-px sm:start-[calc(50%+1.25rem)] sm:top-4 sm:h-px sm:w-[calc(100%-2rem)]",
                  state === "done" ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-warning bg-warning/15 text-amber-700 dark:text-amber-400",
                state === "upcoming" && "border-border bg-background text-muted-foreground"
              )}
            >
              {state === "done" ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : state === "current" ? (
                <Hourglass className="h-4 w-4" aria-hidden="true" />
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-medium",
                  state === "upcoming" && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              <span className="block text-xs text-muted-foreground">{t(`state.${state}`)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export interface SummaryItem {
  label: string
  value: React.ReactNode
  icon: LucideIcon
}

interface PendingStatusCardProps {
  submittedAt: string | null
  summary: SummaryItem[]
  onEdit: () => void
  editing: boolean
}

export function PendingStatusCard({ submittedAt, summary, onEdit, editing }: PendingStatusCardProps) {
  const t = useTranslations("instructorApplication")
  return (
    <section className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-soft">
      <div className="relative border-b bg-gradient-to-br from-warning/10 via-transparent to-primary/5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-amber-700 ring-1 ring-inset ring-warning/25 dark:text-amber-400 sm:h-12 sm:w-12">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="type-h3 break-words">{t("pending.title")}</h2>
                <StatusBadge status="PENDING" label={t("status.PENDING")} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{t("pending.description")}</p>
              {submittedAt && (
                <p className="text-xs text-muted-foreground">
                  {t("pending.submittedOn", { date: submittedAt })}
                </p>
              )}
            </div>
          </div>
          {!editing && (
            <Button variant="outline" onClick={onEdit} className="shrink-0 gap-2 self-start">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("pending.edit")}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <ApplicationTimeline states={["done", "done", "current", "upcoming"]} />

        {summary.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t("pending.summaryTitle")}</h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              {summary.map((item) => (
                <div key={item.label} className="flex min-w-0 items-start gap-3 rounded-lg border bg-muted/30 p-3">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="break-words text-sm font-medium">{item.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="rounded-lg border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
          {t("pending.editHint")}
        </p>
      </div>
    </section>
  )
}

export function RejectedAlert({ reason, reviewedAt }: { reason: string | null; reviewedAt: string | null }) {
  const t = useTranslations("instructorApplication")
  return (
    <section
      role="alert"
      className="overflow-hidden rounded-lg border border-destructive/30 bg-destructive/5 p-4 shadow-soft sm:p-6"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="type-h4 break-words">{t("rejected.title")}</h2>
            <StatusBadge status="REJECTED" label={t("status.REJECTED")} />
          </div>
          <p className="text-sm text-muted-foreground">{t("rejected.description")}</p>
          <div className="rounded-md border border-destructive/20 bg-background p-3">
            <p className="text-xs font-medium text-destructive">{t("rejected.reasonLabel")}</p>
            <p className="mt-1 whitespace-pre-line break-words text-sm">
              {reason?.trim() || t("rejected.noReason")}
            </p>
          </div>
          {reviewedAt && (
            <p className="text-xs text-muted-foreground">{t("rejected.reviewedOn", { date: reviewedAt })}</p>
          )}
        </div>
      </div>
    </section>
  )
}

export function ApprovedCard({ onContinue, busy }: { onContinue: () => void; busy: boolean }) {
  const t = useTranslations("instructorApplication")
  return (
    <section className="overflow-hidden rounded-lg border border-success/30 bg-card shadow-soft">
      <div className="flex flex-col items-center gap-4 bg-gradient-to-b from-success/10 to-transparent px-4 py-10 text-center sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-inset ring-success/25">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="max-w-lg space-y-2">
          <h2 className="type-h2 text-balance">{t("approved.title")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{t("approved.description")}</p>
        </div>
        <Button size="lg" onClick={onContinue} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t("approved.cta")}
          {!busy && <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
        </Button>
      </div>
      <div className="border-t p-4 sm:p-6">
        <ApplicationTimeline states={["done", "done", "done", "done"]} />
      </div>
    </section>
  )
}
