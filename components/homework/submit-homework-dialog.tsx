"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { readError } from "@/components/school/format"

/** Student submits (or edits until graded) their answer: text and/or a link. */
export function SubmitHomeworkDialog({
  open,
  onOpenChange,
  assignment,
  initial,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment: { id: string; title: string; description: string | null; attachmentUrl: string | null } | null
  initial: { content: string | null; linkUrl: string | null } | null
  onSubmitted: () => void
}) {
  const t = useTranslations("homework")
  const [content, setContent] = React.useState("")
  const [linkUrl, setLinkUrl] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setContent(initial?.content ?? "")
    setLinkUrl(initial?.linkUrl ?? "")
    setError(null)
  }, [open, initial])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!assignment) return
    if (!content.trim() && !linkUrl.trim()) return setError(t("errors.emptySubmission"))
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/submission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content || null, linkUrl: linkUrl.trim() || null }),
      })
      if (!res.ok) {
        const err = await readError(res)
        const msg =
          err.code === "past_due"
            ? t("errors.pastDue")
            : err.code === "already_graded"
              ? t("errors.alreadyGraded")
              : err.code === "invalid_url"
                ? t("errors.invalidUrl")
                : t("errors.submitFailed")
        setError(msg)
        toast.error(msg)
        return
      }
      const saved = await res.json()
      toast.success(saved.isLate ? t("student.submittedLate") : t("student.submittedOk"))
      onOpenChange(false)
      onSubmitted()
    } catch {
      toast.error(t("errors.submitFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment?.title}</DialogTitle>
          <DialogDescription>{initial ? t("student.editHint") : t("student.submitHint")}</DialogDescription>
        </DialogHeader>
        {assignment?.description && (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm">{assignment.description}</p>
        )}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="sub-content">{t("student.answer")}</Label>
            <Textarea id="sub-content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-link">{t("student.link")}</Label>
            <Input id="sub-link" type="url" dir="ltr" placeholder="https://" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("student.linkHint")}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {initial ? t("student.update") : t("student.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
