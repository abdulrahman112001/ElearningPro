"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { readError, toLocalInput } from "@/components/school/format"

const NONE = "__none__"

export interface AssignmentFormValue {
  id: string
  title: string
  description: string | null
  subject: string | null
  dueAt: string | null
  maxScore: number
  allowLate: boolean
  attachmentUrl: string | null
}

interface Options {
  groups: { id: string; name: string; organization: { name: string } | null; members: number }[]
  courses: { id: string; titleAr: string; titleEn: string; lessons: { id: string; titleAr: string; titleEn: string }[] }[]
}

/** Create (no `assignment`) or edit homework. The target can only be chosen when creating. */
export function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment?: AssignmentFormValue | null
  onSaved: (saved: { id: string }) => void
}) {
  const t = useTranslations("homework")
  const locale = useLocale()
  const pick = (ar: string, en: string) => (locale === "ar" ? ar || en : en || ar)
  const editing = !!assignment
  const [options, setOptions] = React.useState<Options | null>(null)
  const [targetType, setTargetType] = React.useState<"group" | "course">("group")
  const [groupId, setGroupId] = React.useState("")
  const [courseId, setCourseId] = React.useState("")
  const [lessonId, setLessonId] = React.useState(NONE)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [dueAt, setDueAt] = React.useState("")
  const [maxScore, setMaxScore] = React.useState("10")
  const [allowLate, setAllowLate] = React.useState(true)
  const [attachmentUrl, setAttachmentUrl] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setFieldError(null)
    setTitle(assignment?.title ?? "")
    setDescription(assignment?.description ?? "")
    setSubject(assignment?.subject ?? "")
    setDueAt(toLocalInput(assignment?.dueAt))
    setMaxScore(String(assignment?.maxScore ?? 10))
    setAllowLate(assignment?.allowLate ?? true)
    setAttachmentUrl(assignment?.attachmentUrl ?? "")
    if (!editing && !options) {
      fetch("/api/assignments/options")
        .then((r) => (r.ok ? r.json() : { groups: [], courses: [] }))
        .then((o: Options) => {
          setOptions(o)
          if (o.groups[0]) setGroupId(o.groups[0].id)
          else if (o.courses[0]) setTargetType("course")
          if (o.courses[0]) setCourseId(o.courses[0].id)
        })
        .catch(() => setOptions({ groups: [], courses: [] }))
    }
  }, [open, assignment, editing, options])

  const lessons = options?.courses.find((c) => c.id === courseId)?.lessons ?? []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)
    const max = Number(maxScore)
    if (!title.trim()) return setFieldError("title")
    if (!Number.isFinite(max) || max <= 0 || max > 1000) return setFieldError("maxScore")
    if (!editing && targetType === "group" && !groupId) return setFieldError("target")
    if (!editing && targetType === "course" && !courseId) return setFieldError("target")
    setSaving(true)
    const payload: Record<string, unknown> = {
      title,
      description: description || null,
      subject: subject || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      maxScore: max,
      allowLate,
      attachmentUrl: attachmentUrl || null,
    }
    if (!editing) {
      if (targetType === "group") payload.groupId = groupId
      else {
        payload.courseId = courseId
        if (lessonId !== NONE) payload.lessonId = lessonId
      }
    }
    try {
      const res = await fetch(editing ? `/api/assignments/${assignment!.id}` : "/api/assignments", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await readError(res)
        if (err.field) setFieldError(err.field)
        toast.error(
          err.code === "scores_above_max"
            ? t("errors.scoresAboveMax")
            : err.code === "invalid_url"
              ? t("errors.invalidUrl")
              : res.status === 403
                ? t("errors.forbidden")
                : t("errors.saveFailed")
        )
        return
      }
      const saved = await res.json()
      toast.success(editing ? t("form.updated") : t("form.created", { count: saved.notified ?? 0 }))
      onOpenChange(false)
      onSaved(saved)
    } catch {
      toast.error(t("errors.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const noTargets = !editing && options && options.groups.length === 0 && options.courses.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>
        {noTargets ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t("form.noTargets")}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {!editing && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <Label>{t("form.target")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["group", "course"] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={targetType === type ? "default" : "outline"}
                      onClick={() => setTargetType(type)}
                    >
                      {type === "group" ? t("form.targetGroup") : t("form.targetCourse")}
                    </Button>
                  ))}
                </div>
                {!options ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : targetType === "group" ? (
                  options.groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("form.noGroups")}</p>
                  ) : (
                    <Select value={groupId} onValueChange={setGroupId}>
                      <SelectTrigger aria-label={t("form.group")}>
                        <SelectValue placeholder={t("form.group")} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.organization ? `${g.name} · ${g.organization.name}` : g.name} ({t("form.studentsCount", { count: g.members })})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                ) : options.courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("form.noCourses")}</p>
                ) : (
                  <div className="grid gap-2">
                    <Select
                      value={courseId}
                      onValueChange={(v) => {
                        setCourseId(v)
                        setLessonId(NONE)
                      }}
                    >
                      <SelectTrigger aria-label={t("form.course")}>
                        <SelectValue placeholder={t("form.course")} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {pick(c.titleAr, c.titleEn)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={lessonId} onValueChange={setLessonId}>
                      <SelectTrigger aria-label={t("form.lesson")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("form.noLesson")}</SelectItem>
                        {lessons.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {pick(l.titleAr, l.titleEn)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {fieldError === "target" && <p className="text-xs text-destructive">{t("errors.targetRequired")}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="hw-title">{t("form.title")}</Label>
              <Input id="hw-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={fieldError === "title"} />
              {fieldError === "title" && <p className="text-xs text-destructive">{t("errors.titleRequired")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hw-desc">{t("form.instructions")}</Label>
              <Textarea id="hw-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hw-subject">{t("form.subject")}</Label>
                <Input id="hw-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hw-max">{t("form.maxScore")}</Label>
                <Input
                  id="hw-max"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={1000}
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  aria-invalid={fieldError === "maxScore"}
                />
                {fieldError === "maxScore" && <p className="text-xs text-destructive">{t("errors.maxScore")}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hw-due">{t("form.dueAt")}</Label>
              <Input id="hw-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="hw-late">{t("form.allowLate")}</Label>
                <p className="text-xs text-muted-foreground">{t("form.allowLateHint")}</p>
              </div>
              <Switch id="hw-late" checked={allowLate} onCheckedChange={setAllowLate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hw-url">{t("form.attachment")}</Label>
              <Input
                id="hw-url"
                type="url"
                dir="ltr"
                placeholder="https://"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                aria-invalid={fieldError === "attachmentUrl"}
              />
              {fieldError === "attachmentUrl" && <p className="text-xs text-destructive">{t("errors.invalidUrl")}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {editing ? t("form.save") : t("form.create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
