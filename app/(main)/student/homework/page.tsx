"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, ExternalLink, Hourglass, Paperclip, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardSkeleton, EmptyState, PageHeader, ScoreBar } from "@/components/shared"
import { Pill } from "@/components/homework/pill"
import { SubmitHomeworkDialog } from "@/components/homework/submit-homework-dialog"
import { intlLocale, relativeTime } from "@/components/school/format"
import { cn } from "@/lib/utils"

type Status = "pending" | "submitted" | "graded"

interface Item {
  id: string
  title: string
  description: string | null
  subject: string | null
  dueAt: string | null
  maxScore: number
  allowLate: boolean
  attachmentUrl: string | null
  group: { id: string; name: string } | null
  course: { id: string; titleAr: string; titleEn: string; slug: string } | null
  lesson: { id: string; titleAr: string; titleEn: string } | null
  teacher: { id: string; name: string | null }
  status: Status
  closed: boolean
  submission: {
    content: string | null
    linkUrl: string | null
    submittedAt: string
    isLate: boolean
    score: number | null
    feedback: string | null
    gradedAt: string | null
  } | null
}

export default function StudentHomeworkPage() {
  const t = useTranslations("homework")
  const locale = useLocale()
  const pick = (ar: string, en: string) => (locale === "ar" ? ar || en : en || ar)
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 })
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" })
  const [items, setItems] = React.useState<Item[] | null>(null)
  const [error, setError] = React.useState(false)
  const [tab, setTab] = React.useState<Status>("pending")
  const [active, setActive] = React.useState<Item | null>(null)
  const [now, setNow] = React.useState(() => Date.now())

  const load = React.useCallback(() => {
    fetch("/api/assignments/mine")
      .then(async (r) => {
        if (!r.ok) throw new Error()
        setItems((await r.json()).assignments)
      })
      .catch(() => setError(true))
  }, [])

  React.useEffect(() => {
    const qs = new URLSearchParams(window.location.search).get("tab")
    if (qs === "submitted" || qs === "graded") setTab(qs)
    load()
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [load])

  const by = (s: Status) => (items ?? []).filter((i) => i.status === s)

  const card = (i: Item) => {
    const due = i.dueAt ? new Date(i.dueAt).getTime() : null
    const overdue = due !== null && due < now
    const soon = due !== null && !overdue && due - now < 48 * 3600_000
    const percent = i.submission?.score != null ? (i.submission.score / i.maxScore) * 100 : null
    return (
      <li key={i.id} className="rounded-lg border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="break-words font-semibold">{i.title}</h3>
            <p className="text-xs text-muted-foreground">
              {[i.subject, i.group?.name ?? (i.course ? pick(i.course.titleAr, i.course.titleEn) : null), i.teacher.name]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {i.status === "graded" ? (
              <Pill tone="success">{t("status.graded")}</Pill>
            ) : i.status === "submitted" ? (
              <Pill tone="info">{t("status.submitted")}</Pill>
            ) : i.closed ? (
              <Pill tone="danger">{t("status.closed")}</Pill>
            ) : overdue ? (
              <Pill tone="danger">{t("status.overdue")}</Pill>
            ) : (
              <Pill tone={soon ? "warning" : "neutral"}>{t("status.pending")}</Pill>
            )}
            {i.submission?.isLate && <Pill tone="warning">{t("status.late")}</Pill>}
          </div>
        </div>

        {i.description && i.status === "pending" && (
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{i.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {i.dueAt ? (
            <span className={cn("inline-flex items-center gap-1.5", overdue && i.status === "pending" ? "text-destructive" : soon ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
              <Clock className="h-4 w-4" />
              {t("student.due", { date: dateFmt.format(new Date(i.dueAt)), relative: relativeTime(locale, i.dueAt, now) })}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("noDueDate")}</span>
          )}
          {i.attachmentUrl && (
            <a href={i.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Paperclip className="h-4 w-4" />
              {t("detail.attachment")}
            </a>
          )}
        </div>

        {i.status === "graded" && i.submission && (
          <div className="mt-4 space-y-2 rounded-md bg-muted/40 p-3">
            <ScoreBar
              value={percent ?? 0}
              size="sm"
              valueLabel={t("student.scoreOf", { score: nf.format(i.submission.score ?? 0), max: nf.format(i.maxScore) })}
            />
            {i.submission.feedback && (
              <p className="whitespace-pre-wrap break-words text-sm">
                <span className="font-medium">{t("grading.feedback")}: </span>
                {i.submission.feedback}
              </p>
            )}
          </div>
        )}

        {i.status === "submitted" && i.submission && (
          <div className="mt-3 text-xs text-muted-foreground">
            {t("detail.submittedAt", { date: dateFmt.format(new Date(i.submission.submittedAt)) })}
            {i.submission.linkUrl && (
              <a href={i.submission.linkUrl} target="_blank" rel="noopener noreferrer" className="ms-2 inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
                {t("student.yourLink")}
              </a>
            )}
          </div>
        )}

        {i.status !== "graded" && !i.closed && (
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant={i.status === "submitted" ? "outline" : "default"} onClick={() => setActive(i)}>
              <Send className="me-2 h-4 w-4 rtl:-scale-x-100" />
              {i.status === "submitted" ? t("student.editSubmission") : overdue ? t("student.submitLate") : t("student.submit")}
            </Button>
          </div>
        )}
      </li>
    )
  }

  const empty: Record<Status, string> = {
    pending: t("student.emptyPending"),
    submitted: t("student.emptySubmitted"),
    graded: t("student.emptyGraded"),
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardList} title={t("student.title")} description={t("student.subtitle")} />
      {error ? (
        <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
      ) : !items ? (
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
            <TabsTrigger value="pending">
              <Hourglass className="me-1.5 hidden h-4 w-4 sm:inline" />
              {t("student.tabPending")} ({nf.format(by("pending").length)})
            </TabsTrigger>
            <TabsTrigger value="submitted">
              <Send className="me-1.5 hidden h-4 w-4 sm:inline rtl:-scale-x-100" />
              {t("student.tabSubmitted")} ({nf.format(by("submitted").length)})
            </TabsTrigger>
            <TabsTrigger value="graded">
              <CheckCircle2 className="me-1.5 hidden h-4 w-4 sm:inline" />
              {t("student.tabGraded")} ({nf.format(by("graded").length)})
            </TabsTrigger>
          </TabsList>
          {(["pending", "submitted", "graded"] as Status[]).map((s) => (
            <TabsContent key={s} value={s} className="mt-4">
              {by(s).length === 0 ? (
                <EmptyState icon={ClipboardList} title={empty[s]} size="sm" />
              ) : (
                <ul className="grid gap-4 lg:grid-cols-2">{by(s).map(card)}</ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
      <SubmitHomeworkDialog
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
        assignment={active}
        initial={active?.submission ? { content: active.submission.content, linkUrl: active.submission.linkUrl } : null}
        onSubmitted={load}
      />
    </div>
  )
}
