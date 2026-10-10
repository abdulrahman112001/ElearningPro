"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { readError } from "@/components/school/format"

/** Inline score + feedback form for one submission. */
export function GradeSubmissionForm({
  assignmentId,
  submissionId,
  maxScore,
  initialScore,
  initialFeedback,
  onGraded,
}: {
  assignmentId: string
  submissionId: string
  maxScore: number
  initialScore: number | null
  initialFeedback: string | null
  onGraded: (s: { score: number; feedback: string | null; gradedAt: string }) => void
}) {
  const t = useTranslations("homework")
  const [score, setScore] = React.useState(initialScore === null ? "" : String(initialScore))
  const [feedback, setFeedback] = React.useState(initialFeedback ?? "")
  const [saving, setSaving] = React.useState(false)
  const [invalid, setInvalid] = React.useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(score)
    if (score.trim() === "" || !Number.isFinite(n) || n < 0 || n > maxScore) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: n, feedback: feedback || null }),
      })
      if (!res.ok) {
        const err = await readError(res)
        if (err.field === "score") setInvalid(true)
        toast.error(t("errors.gradeFailed"))
        return
      }
      const saved = await res.json()
      toast.success(t("grading.saved"))
      onGraded(saved)
    } catch {
      toast.error(t("errors.gradeFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-2" noValidate>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={maxScore}
          step="any"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="h-9 w-24"
          aria-label={t("grading.score")}
          aria-invalid={invalid}
        />
        <span className="text-sm text-muted-foreground">/ {maxScore}</span>
        <Button type="submit" size="sm" disabled={saving} className="ms-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          <span className="ms-1.5">{t("grading.save")}</span>
        </Button>
      </div>
      {invalid && <p className="text-xs text-destructive">{t("errors.scoreRange", { max: maxScore })}</p>}
      <Textarea
        rows={2}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={t("grading.feedbackPlaceholder")}
        aria-label={t("grading.feedback")}
      />
    </form>
  )
}
