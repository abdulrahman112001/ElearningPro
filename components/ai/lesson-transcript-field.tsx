"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { FileText, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const MAX = 50_000

export interface LessonTranscriptFieldProps {
  lessonId: string
  initialValue?: string | null
}

/** Lesson text (transcript / notes) the AI tutor and question generator use. */
export function LessonTranscriptField({ lessonId, initialValue }: LessonTranscriptFieldProps) {
  const t = useTranslations("ai")
  const locale = useLocale()
  const [value, setValue] = React.useState(initialValue ?? "")
  const [saved, setSaved] = React.useState(initialValue ?? "")
  const [saving, setSaving] = React.useState(false)
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dirty = value !== saved
  const tooLong = value.length > MAX

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/instructor/lessons/${lessonId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.code === "too_long" ? t("transcriptTooLong") : body.error || t("transcriptFailed"))
        return
      }
      setSaved(value)
      toast.success(t("transcriptSaved"))
    } catch {
      toast.error(t("transcriptFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`transcript-${lessonId}`} className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        {t("transcriptLabel")}
      </Label>
      <p className="text-xs text-muted-foreground">{t("transcriptHelp")}</p>
      <Textarea
        id={`transcript-${lessonId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        dir="auto"
        placeholder={t("transcriptPlaceholder")}
        className="min-h-[160px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-xs tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}>
          {t("characters", { count: value.length, max: nf.format(MAX) })}
        </span>
        <Button type="button" size="sm" onClick={save} disabled={!dirty || saving || tooLong} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("transcriptSave")}
        </Button>
      </div>
    </div>
  )
}
