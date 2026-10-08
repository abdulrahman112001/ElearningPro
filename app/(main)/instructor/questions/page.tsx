"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircleQuestion,
  MessagesSquare,
  PlayCircle,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AvatarName, EmptyState, ListSkeleton, PageHeader, StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"

type Status = "unanswered" | "all"

interface UserLite {
  id: string
  name: string | null
  image: string | null
  role?: string
}

interface QuestionItem {
  id: string
  title: string
  content: string
  createdAt: string
  user: UserLite
  answeredByInstructor: boolean
  lesson: {
    id: string
    titleAr: string | null
    titleEn: string
    chapter: { course: { id: string; titleAr: string; titleEn: string; slug: string } }
  }
  answers: { id: string; content: string; createdAt: string; userId: string; user: UserLite }[]
}

export default function InstructorQuestionsPage() {
  const t = useTranslations("qaInbox")
  const locale = useLocale()
  const [status, setStatus] = React.useState<Status>("unanswered")
  const [questions, setQuestions] = React.useState<QuestionItem[] | null>(null)
  const [unanswered, setUnanswered] = React.useState(0)
  const [error, setError] = React.useState(false)
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [posting, setPosting] = React.useState<string | null>(null)

  const pick = (ar?: string | null, en?: string | null) =>
    locale === "ar" ? ar || en || "" : en || ar || ""
  const rtf = React.useMemo(
    () => new Intl.RelativeTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { numeric: "auto" }),
    [locale]
  )
  const ago = (iso: string) => {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000
    const abs = Math.abs(diff)
    if (abs < 60) return rtf.format(Math.round(diff), "second")
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute")
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour")
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day")
    if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month")
    return rtf.format(Math.round(diff / (86400 * 365)), "year")
  }

  const load = React.useCallback(async (s: Status) => {
    setError(false)
    setQuestions(null)
    try {
      const res = await fetch(`/api/instructor/questions?status=${s}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setQuestions(data.questions)
      setUnanswered(data.unanswered)
    } catch {
      setError(true)
      setQuestions([])
    }
  }, [])

  React.useEffect(() => {
    load(status)
  }, [status, load])

  const submitAnswer = async (questionId: string) => {
    const content = (drafts[questionId] ?? "").trim()
    if (!content) {
      toast.error(t("answerRequired"))
      return
    }
    setPosting(questionId)
    try {
      const res = await fetch(`/api/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error()
      const answer = await res.json()
      toast.success(t("answerPosted"))
      setDrafts((d) => ({ ...d, [questionId]: "" }))
      setUnanswered((n) => {
        const q = questions?.find((x) => x.id === questionId)
        return q && !q.answeredByInstructor ? Math.max(0, n - 1) : n
      })
      setQuestions((list) => {
        if (!list) return list
        if (status === "unanswered") return list.filter((q) => q.id !== questionId)
        return list.map((q) =>
          q.id === questionId
            ? { ...q, answeredByInstructor: true, answers: [...q.answers, answer] }
            : q
        )
      })
    } catch {
      toast.error(t("answerFailed"))
    } finally {
      setPosting(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={MessagesSquare} title={t("title")} description={t("subtitle")}>
        <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
          <TabsList>
            <TabsTrigger value="unanswered" className="gap-2">
              {t("tabUnanswered")}
              {unanswered > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                  {unanswered}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">{t("tabAll")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {questions === null ? (
        <ListSkeleton rows={4} withAction />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={error ? MessageCircleQuestion : CheckCircle2}
          title={error ? t("loadFailed") : status === "unanswered" ? t("emptyUnansweredTitle") : t("emptyAllTitle")}
          description={error ? undefined : status === "unanswered" ? t("emptyUnansweredHint") : t("emptyAllHint")}
        />
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const course = q.lesson.chapter.course
            const lessonHref = `/courses/${course.slug}/learn/${q.lesson.id}`
            return (
              <article
                key={q.id}
                className={cn(
                  "overflow-hidden rounded-lg border bg-card shadow-soft",
                  !q.answeredByInstructor && "border-s-4 border-s-warning"
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-full truncate font-medium text-foreground/80">
                    {pick(course.titleAr, course.titleEn)}
                  </span>
                  <span aria-hidden="true">/</span>
                  <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-full truncate">{pick(q.lesson.titleAr, q.lesson.titleEn)}</span>
                  <Link
                    href={lessonHref}
                    className="ms-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {t("openLesson")}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-4 p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <AvatarName name={q.user.name} image={q.user.image} secondary={ago(q.createdAt)} />
                    <StatusBadge status={q.answeredByInstructor ? "ANSWERED" : "UNANSWERED"} />
                  </div>
                  <div className="space-y-1.5">
                    {q.title && <h3 className="font-semibold leading-snug">{q.title}</h3>}
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground" dir="auto">
                      {q.content}
                    </p>
                  </div>

                  {q.answers.length > 0 && (
                    <div className="space-y-3 border-s-2 border-primary/20 ps-4">
                      {q.answers.map((a) => {
                        const isTeacher = a.user.role === "INSTRUCTOR" || a.user.role === "ADMIN"
                        return (
                          <div key={a.id} className={cn("rounded-md p-3", isTeacher ? "bg-primary/5" : "bg-muted/40")}>
                            <AvatarName
                              size="sm"
                              name={a.user.name}
                              image={a.user.image}
                              secondary={ago(a.createdAt)}
                              badge={
                                isTeacher ? (
                                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                    {t("teacherBadge")}
                                  </span>
                                ) : undefined
                              }
                            />
                            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed" dir="auto">
                              {a.content}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      submitAnswer(q.id)
                    }}
                    className="space-y-2"
                  >
                    <Textarea
                      value={drafts[q.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      placeholder={q.answeredByInstructor ? t("replyPlaceholder") : t("answerPlaceholder")}
                      rows={3}
                      maxLength={5000}
                      disabled={posting === q.id}
                      aria-label={t("answerPlaceholder")}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        className="gap-2"
                        disabled={posting === q.id || !(drafts[q.id] ?? "").trim()}
                      >
                        {posting === q.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 rtl:-scale-x-100" />
                        )}
                        {q.answeredByInstructor ? t("reply") : t("postAnswer")}
                      </Button>
                    </div>
                  </form>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
