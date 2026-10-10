"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AiDisabledNotice, aiErrorKind } from "@/components/ai/ai-disabled-notice"
import { cn } from "@/lib/utils"

/**
 * CONTRACT (used by the exams feature): a dialog that generates quiz
 * questions with AI from a lesson / course and hands them to `onInsert`.
 */
export type GeneratedQuestion = {
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT" | "ESSAY"
  question: string
  questionAr?: string
  options: { id: string; text: string; textAr?: string; isCorrect: boolean }[]
  explanation?: string
  explanationAr?: string
  points: number
}

export interface GenerateQuestionsDialogProps {
  lessonId?: string
  courseId?: string
  onInsert: (questions: GeneratedQuestion[]) => void
  trigger?: ReactNode
}

const TYPES: GeneratedQuestion["type"][] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTIPLE_SELECT", "ESSAY"]
type Difficulty = "easy" | "medium" | "hard" | "mixed"
type Language = "ar" | "en" | "both"

export function GenerateQuestionsDialog({ lessonId, courseId, onInsert, trigger }: GenerateQuestionsDialogProps) {
  const t = useTranslations("ai")
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  const [count, setCount] = React.useState(5)
  const [types, setTypes] = React.useState<GeneratedQuestion["type"][]>(["MULTIPLE_CHOICE", "TRUE_FALSE"])
  const [difficulty, setDifficulty] = React.useState<Difficulty>("medium")
  const [language, setLanguage] = React.useState<Language>(locale === "en" ? "en" : "ar")
  const [loading, setLoading] = React.useState(false)
  const [disabled, setDisabled] = React.useState<null | "not_configured" | "daily_limit">(null)
  const [questions, setQuestions] = React.useState<GeneratedQuestion[] | null>(null)
  const [selected, setSelected] = React.useState<Set<number>>(new Set())

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft

  React.useEffect(() => {
    if (!open) return
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return
        if (!s.configured) setDisabled("not_configured")
        else if (s.exceeded) setDisabled("daily_limit")
      })
      .catch(() => undefined)
  }, [open])

  const toggleType = (type: GeneratedQuestion["type"]) =>
    setTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]))

  const generate = async () => {
    if (!types.length) {
      toast.error(t("pickType"))
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, courseId: lessonId ? undefined : courseId, count, types, difficulty, language }),
      })
      if (!res.ok) {
        const { kind, message } = await aiErrorKind(res)
        if (kind !== "other") setDisabled(kind)
        else toast.error(message || t("generateFailed"))
        return
      }
      const data: { questions: GeneratedQuestion[] } = await res.json()
      setQuestions(data.questions)
      setSelected(new Set(data.questions.map((_, i) => i)))
    } catch {
      toast.error(t("generateFailed"))
    } finally {
      setLoading(false)
    }
  }

  const insert = () => {
    if (!questions) return
    const chosen = questions.filter((_, i) => selected.has(i))
    if (!chosen.length) return
    onInsert(chosen)
    toast.success(t("inserted", { count: chosen.length }))
    setOpen(false)
    setQuestions(null)
  }

  const textOf = (ar?: string, en?: string) => (locale === "ar" ? ar || en : en || ar) || ""

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuestions(null)
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t("generateButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("generateTitle")}
          </DialogTitle>
          <DialogDescription>{lessonId ? t("generateFromLesson") : t("generateFromCourse")}</DialogDescription>
        </DialogHeader>

        {disabled ? (
          <AiDisabledNotice reason={disabled} />
        ) : !questions ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ai-count">{t("count")}</Label>
                <Input
                  id="ai-count"
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("difficulty")}</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                      <SelectItem key={d} value={d}>
                        {t(`difficulties.${d}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("questionLanguage")}</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["ar", "en", "both"] as const).map((l) => (
                      <SelectItem key={l} value={l}>
                        {t(`languages.${l}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("types")}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPES.map((type) => (
                  <label
                    key={type}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                      types.includes(type) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox checked={types.includes(type)} onCheckedChange={() => toggleType(type)} />
                    {t(`questionTypes.${type}`)}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("reviewHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {t("previewCount", { selected: selected.size, total: questions.length })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelected(selected.size === questions.length ? new Set() : new Set(questions.map((_, i) => i)))
                }
              >
                {selected.size === questions.length ? t("selectNone") : t("selectAll")}
              </Button>
            </div>
            <ul className="space-y-3">
              {questions.map((q, i) => (
                <li
                  key={i}
                  className={cn("rounded-lg border p-3 transition-colors", selected.has(i) && "border-primary/60 bg-primary/5")}
                >
                  <label className="flex cursor-pointer gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={selected.has(i)}
                      onCheckedChange={(c) =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (c) next.add(i)
                          else next.delete(i)
                          return next
                        })
                      }
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{t(`questionTypes.${q.type}`)}</Badge>
                        <span className="text-xs text-muted-foreground">{t("points", { count: q.points })}</span>
                      </div>
                      <p className="break-words font-medium" dir="auto">
                        {nf.format(i + 1)}. {textOf(q.questionAr, q.question)}
                      </p>
                      {q.options.length > 0 && (
                        <ul className="space-y-1">
                          {q.options.map((o) => (
                            <li
                              key={o.id}
                              dir="auto"
                              className={cn(
                                "flex items-start gap-2 text-sm",
                                o.isCorrect ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                              )}
                            >
                              {o.isCorrect ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                              ) : (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                              )}
                              <span className="break-words">{textOf(o.textAr, o.text)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(q.explanation || q.explanationAr) && (
                        <p className="break-words text-xs text-muted-foreground" dir="auto">
                          {textOf(q.explanationAr, q.explanation)}
                        </p>
                      )}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          {disabled ? (
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
          ) : !questions ? (
            <Button type="button" onClick={generate} disabled={loading || !types.length} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? t("generating") : t("generate")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setQuestions(null)} className="gap-2">
                <BackIcon className="h-4 w-4" />
                {t("back")}
              </Button>
              <Button type="button" onClick={insert} disabled={!selected.size}>
                {t("insertSelected", { count: selected.size })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
