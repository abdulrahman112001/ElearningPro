"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"

export type ApplicationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
export type ReviewAction = "approve" | "reject" | "revoke"

export const REASON_MIN = 5

/** Pill for an application status: PENDING amber, DRAFT gray, APPROVED green, REJECTED red. */
export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus
  className?: string
}) {
  const t = useTranslations("adminInstructorReview.status")
  return (
    <StatusBadge
      status={status}
      label={t(status)}
      tone={
        status === "PENDING"
          ? "warning"
          : status === "APPROVED"
            ? "success"
            : status === "REJECTED"
              ? "danger"
              : "neutral"
      }
      className={className}
    />
  )
}

/** Translated labels for stored option values, falling back to the raw value. */
export function useApplicationLabels() {
  const t = useTranslations("adminInstructorReview")
  const lookup = useCallback(
    (group: "governorates" | "qualifications" | "genders", raw: string | null | undefined) => {
      if (!raw) return null
      const key = `${group}.${group === "governorates" ? raw.replace(/\s+/g, "") : raw}`
      return t.has(key) ? t(key) : raw
    },
    [t]
  )
  return {
    governorate: (v: string | null | undefined) => lookup("governorates", v),
    qualification: (v: string | null | undefined) => lookup("qualifications", v),
    gender: (v: string | null | undefined) => lookup("genders", v),
  }
}

/** Runs approve / reject / revoke against the admin API and reports via toast. */
export function useReviewAction() {
  const t = useTranslations("adminInstructorReview.toast")
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async (id: string, action: ReviewAction, reason?: string) => {
      setPending(true)
      try {
        const res = await fetch(`/api/admin/instructors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason: reason?.trim() || undefined }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data?.code === "reason_required" ? t("reasonRequired") : t("failed"))
          return false
        }
        toast.success(
          action === "approve" ? t("approved") : action === "reject" ? t("rejected") : t("revoked")
        )
        return true
      } catch {
        toast.error(t("failed"))
        return false
      } finally {
        setPending(false)
      }
    },
    [t]
  )

  return { run, pending }
}

/**
 * Confirmation body for a review decision: explanation, reason textarea
 * (required for reject, optional for revoke) and the confirm/back buttons.
 */
export function ReviewActionPanel({
  action,
  name,
  pending,
  onConfirm,
  onCancel,
  className,
}: {
  action: ReviewAction
  name: string
  pending: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
  className?: string
}) {
  const t = useTranslations("adminInstructorReview.confirm")
  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)

  const needsReason = action === "reject"
  const tooShort = needsReason && reason.trim().length < REASON_MIN
  const showError = touched && tooShort

  const description =
    action === "approve"
      ? t("approveDescription", { name })
      : action === "reject"
        ? t("rejectDescription", { name })
        : t("revokeDescription", { name })

  const submit = () => {
    setTouched(true)
    if (tooShort) return
    onConfirm(reason)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>

      {action !== "approve" && (
        <div className="space-y-2">
          <Label htmlFor={`review-reason-${action}`}>
            {needsReason ? t("reasonLabel") : t("reasonOptionalLabel")}
          </Label>
          <Textarea
            id={`review-reason-${action}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={t("reasonPlaceholder")}
            rows={4}
            maxLength={2000}
            autoFocus
            aria-invalid={showError}
            aria-describedby={showError ? `review-reason-${action}-error` : undefined}
            className={cn(showError && "border-destructive focus-visible:ring-destructive/40")}
          />
          {showError && (
            <p id={`review-reason-${action}-error`} className="text-xs text-destructive">
              {t("reasonTooShort")}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t("back")}
        </Button>
        <Button
          type="button"
          variant={action === "approve" ? "default" : "destructive"}
          onClick={submit}
          disabled={pending || (touched && tooShort)}
          className={cn(action === "approve" && "bg-success text-success-foreground hover:bg-success/90")}
        >
          {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {action === "approve"
            ? t("approveButton")
            : action === "reject"
              ? t("rejectButton")
              : t("revokeButton")}
        </Button>
      </div>
    </div>
  )
}
