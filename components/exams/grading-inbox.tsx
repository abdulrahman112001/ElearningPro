"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { BookOpen, CheckCircle2, ClipboardCheck, EyeOff, Hourglass, Loader2, PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AvatarName, EmptyState, ListSkeleton, PageHeader, ScoreBar } from "@/components/shared"
import { cn } from "@/lib/utils"

type Status = "pending" | "graded" | "all"

interface UserLite {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface AttemptRow {
  id: string
  score: number
  passed: boolean
  needsGrading: boolean
  completedAt: string
  tabSwitches: number
  attemptNumber: number
  essayCount: number
  ungradedCount: number
  user: UserLite
  quiz: {
    id: string
    title: string
    titleAr: string | null
    lesson: {
      id: string
      titleEn: string
      titleAr: string | null
      chapter: { course: { id: string; titleEn: string; titleAr: string | null; slug: string } }
    }
  }
}

interface DetailQuestion {
  id: string
  question: string
  questionAr: string | null
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT" | "ESSAY"
  points: number
  imageUrl: string | null
  options: { id: string; text: string; textAr?: string | null; isCorrect: boolean }[]
  answer: {
    answer: unknown
    textAnswer: string | null
    isCorrect: boolean
    points: number
    manualScore: number | null
    feedback: string | null
    gradedAt: string | null
  } | null
}

interface AttemptDetail {
  id: string
  score: number
  passed: boolean
  needsGrading: boolean
  completedAt: string
  timeSpent: number | null
  tabSwitches: number
  attemptNumber: number
  user: UserLite
  quiz: { id: string; title: string; titleAr: string | null; passingScore: number; detectTabSwitch: boolean }
  questions: DetailQuestion[]
}

export function GradingInbox() {
  const t = useTranslations("exams")
  const locale = useLocale()
  const searchParams = useSearchParams()
  const [status, setStatus] = React.useState<Status>("pending")
  const [rows, setRows] = React.useState<AttemptRow[] | null>(null)
  const [pending, setPending] = React.useState(0)
  const [error, setError] = React.useState(false)
  const [openId, setOpenId] = React.useState<string | null>(searchParams?.get("attempt") ?? null)

  const pick = (ar?: string | null, en?: string | null) => (locale === "ar" ? ar || en || "" : en || ar || "")
  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  )

  const load = React.useCallback(async (s: Status) => {
    setError(false)
    setRows(null)
    try {
      const res = await fetch(`/api/instructor/grading?status=${s}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.attempts)
      setPending(data.pending)
    } catch {
      setError(true)
      setRows([])
    }
  }, [])

  React.useEffect(() => {
    load(status)
  }, [status, load])

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardCheck} title={t("grading.title")} description={t("grading.subtitle")}>
        <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              {t("grading.tabPending")}
              {pending > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                  {pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="graded">{t("grading.tabGraded")}</TabsTrigger>
            <TabsTrigger value="all">{t("grading.tabAll")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {rows === null ? (
        <ListSkeleton rows={4} withAction />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={error ? ClipboardCheck : CheckCircle2}
          title={error ? t("grading.loadFailed") : status === "pending" ? t("grading.emptyPending") : t("grading.emptyAll")}
          description={error ? undefined : t("grading.emptyHint")}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const course = row.quiz.lesson.chapter.course
            return (
              <article
                key={row.id}
                className={cn(
                  "overflow-hidden rounded-lg border bg-card shadow-soft",
                  row.needsGrading && "border-s-4 border-s-warning"
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-full truncate font-medium text-foreground/80">
                    {pick(course.titleAr, course.titleEn)}
                  </span>
                  <span aria-hidden="true">/</span>
                  <span className="max-w-full truncate">{pick(row.quiz.titleAr, row.quiz.title)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <AvatarName
                    name={row.user.name}
                    image={row.user.image}
                    secondary={dateFmt.format(new Date(row.completedAt))}
                    className="min-w-0 flex-1"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{t("grading.attemptNumber", { number: row.attemptNumber })}</Badge>
                    {row.tabSwitches > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <EyeOff className="h-3 w-3" />
                        {t("client.tabSwitchCount", { count: row.tabSwitches })}
                      </Badge>
                    )}
                    {row.needsGrading ? (
                      <Badge variant="secondary" className="gap-1">
                        <Hourglass className="h-3 w-3" />
                        {t("grading.essaysToGrade", { count: row.ungradedCount })}
                      </Badge>
                    ) : (
                      <Badge variant={row.passed ? "default" : "destructive"}>
                        {Math.round(row.score)}% · {row.passed ? t("grading.passed") : t("grading.failed")}
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant={row.needsGrading ? "default" : "outline"} onClick={() => setOpenId(row.id)}>
                    <PenLine className="me-2 h-4 w-4" />
                    {row.needsGrading ? t("grading.grade") : t("grading.review")}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <GradeDialog
        attemptId={openId}
        onClose={() => setOpenId(null)}
        onGraded={() => load(status)}
      />
    </div>
  )
}

function GradeDialog({
  attemptId,
  onClose,
  onGraded,
}: {
  attemptId: string | null
  onClose: () => void
  onGraded: () => void
}) {
  const t = useTranslations("exams")
  const locale = useLocale()
  const [detail, setDetail] = React.useState<AttemptDetail | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [drafts, setDrafts] = React.useState<Record<string, { score: string; feedback: string }>>({})
  const [saving, setSaving] = React.useState(false)

  const hydrate = (d: AttemptDetail) => {
    setDetail(d)
    const next: Record<string, { score: string; feedback: string }> = {}
    for (const q of d.questions) {
      if (q.type === "ESSAY" && q.answer) {
        next[q.id] = {
          score: q.answer.manualScore !== null ? String(q.answer.manualScore) : "",
          feedback: q.answer.feedback ?? "",
        }
      }
    }
    setDrafts(next)
  }

  React.useEffect(() => {
    if (!attemptId) return
    setDetail(null)
    setFailed(false)
    fetch(`/api/instructor/grading/${attemptId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        hydrate(await r.json())
      })
      .catch(() => setFailed(true))
  }, [attemptId])

  const save = async () => {
    if (!detail) return
    const grades: { questionId: string; score: number; feedback: string }[] = []
    for (const q of detail.questions) {
      const d = drafts[q.id]
      if (!d || d.score.trim() === "") continue
      const score = Number(d.score)
      if (!Number.isFinite(score) || score < 0 || score > q.points) {
        toast.error(t("grading.scoreRange", { max: q.points }))
        return
      }
      grades.push({ questionId: q.id, score, feedback: d.feedback })
    }
    if (grades.length === 0) {
      toast.error(t("grading.nothingToSave"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/instructor/grading/${detail.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      hydrate(data)
      toast.success(data.needsGrading ? t("grading.savedPartial") : t("grading.saved"))
      onGraded()
      if (!data.needsGrading) onClose()
    } catch (e: any) {
      toast.error(e?.message || t("grading.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const text = (ar?: string | null, en?: string | null) => (locale === "ar" ? ar || en : en || ar)
  const selected = (a: unknown) => (Array.isArray(a) ? a.map(String) : a ? [String(a)] : [])

  return (
    <Dialog open={!!attemptId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{detail ? text(detail.quiz.titleAr, detail.quiz.title) : t("grading.title")}</DialogTitle>
          {detail && (
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-2">
                <span>{detail.user.name ?? detail.user.email}</span>
                <Badge variant="outline">{t("grading.attemptNumber", { number: detail.attemptNumber })}</Badge>
                {detail.quiz.detectTabSwitch && (
                  <Badge variant={detail.tabSwitches > 0 ? "destructive" : "outline"} className="gap-1">
                    <EyeOff className="h-3 w-3" />
                    {t("client.tabSwitchCount", { count: detail.tabSwitches })}
                  </Badge>
                )}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1">
          {failed ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("grading.loadFailed")}</p>
          ) : !detail ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <ScoreBar value={detail.score} label={t("grading.currentScore")} />
              {detail.questions.map((q, i) => {
                const isEssay = q.type === "ESSAY"
                const ids = selected(q.answer?.answer)
                return (
                  <section key={q.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="whitespace-pre-line font-medium" dir="auto">
                        {i + 1}. {text(q.questionAr, q.question)}
                      </p>
                      <Badge variant="outline" className="shrink-0">
                        {t("question.pointsCount", { count: q.points })}
                      </Badge>
                    </div>
                    {q.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.imageUrl} alt="" className="max-h-48 max-w-full rounded-md border object-contain" referrerPolicy="no-referrer" />
                    )}
                    {isEssay ? (
                      <>
                        <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm" dir="auto">
                          {q.answer?.textAnswer || t("grading.noAnswer")}
                        </p>
                        {q.answer?.textAnswer ? (
                          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                            <div className="space-y-1.5">
                              <Label htmlFor={`score-${q.id}`}>{t("grading.score", { max: q.points })}</Label>
                              <Input
                                id={`score-${q.id}`}
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={q.points}
                                step="0.5"
                                value={drafts[q.id]?.score ?? ""}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [q.id]: { ...d[q.id], score: e.target.value } }))
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`fb-${q.id}`}>{t("grading.feedback")}</Label>
                              <Textarea
                                id={`fb-${q.id}`}
                                rows={2}
                                maxLength={5000}
                                value={drafts[q.id]?.feedback ?? ""}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [q.id]: { ...d[q.id], feedback: e.target.value } }))
                                }
                              />
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {q.options.map((o) => (
                          <li
                            key={o.id}
                            className={cn(
                              "rounded-md px-2 py-1",
                              o.isCorrect && "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                              ids.includes(String(o.id)) && !o.isCorrect && "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            )}
                          >
                            {ids.includes(String(o.id)) ? "● " : "○ "}
                            {text(o.textAr, o.text)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
          {detail?.questions.some((q) => q.type === "ESSAY" && q.answer?.textAnswer) && (
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("grading.saveGrades")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
