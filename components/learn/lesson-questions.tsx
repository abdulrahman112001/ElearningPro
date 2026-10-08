"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  CheckCircle2,
  CornerDownLeft,
  GraduationCap,
  Loader2,
  MessageCircleQuestion,
  MessageSquareReply,
  Pin,
  RotateCw,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AvatarName,
  EmptyState,
  ListSkeleton,
  SectionCard,
  StatusBadge,
} from "@/components/shared"
import { cn } from "@/lib/utils"

interface QAUser {
  id: string
  name: string | null
  image: string | null
  role?: string
}

interface QAAnswer {
  id: string
  content: string
  userId: string
  createdAt: string
  user: QAUser
  isInstructor: boolean
  pending?: boolean
}

interface QAQuestion {
  id: string
  title: string
  content: string
  userId: string
  isPinned: boolean
  createdAt: string
  user: QAUser
  answeredByInstructor: boolean
  answers: QAAnswer[]
  pending?: boolean
}

export interface LessonQuestionsProps {
  lessonId: string
  currentUser: { id: string; name?: string | null; image?: string | null }
  /** The viewer teaches this course: their replies count as teacher answers */
  isInstructor?: boolean
  className?: string
}

type Filter = "all" | "mine" | "unanswered"
const MAX_LEN = 5000

function useRelativeTime() {
  const locale = useLocale()
  return useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" })
    const dtf = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" })
    return (iso: string) => {
      const date = new Date(iso)
      const diff = (date.getTime() - Date.now()) / 1000
      const abs = Math.abs(diff)
      if (abs < 60) return rtf.format(Math.round(diff), "second")
      if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute")
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour")
      if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day")
      return dtf.format(date)
    }
  }, [locale])
}

export function LessonQuestions({
  lessonId,
  currentUser,
  isInstructor = false,
  className,
}: LessonQuestionsProps) {
  const t = useTranslations("lessonQA")
  const relTime = useRelativeTime()
  const [questions, setQuestions] = useState<QAQuestion[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  const me: QAUser = {
    id: currentUser.id,
    name: currentUser.name ?? null,
    image: currentUser.image ?? null,
  }

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch(`/api/lessons/${lessonId}/questions`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setQuestions(Array.isArray(data) ? data : [])
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [lessonId])

  useEffect(() => {
    setReplyOpen(null)
    setFilter("all")
    load()
  }, [load])

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || posting) return
    const tempId = `temp-${Date.now()}`
    const optimistic: QAQuestion = {
      id: tempId,
      title: content.slice(0, 80),
      content,
      userId: me.id,
      isPinned: false,
      createdAt: new Date().toISOString(),
      user: me,
      answeredByInstructor: false,
      answers: [],
      pending: true,
    }
    setQuestions((qs) => {
      const pinned = qs.filter((q) => q.isPinned)
      const rest = qs.filter((q) => !q.isPinned)
      return [...pinned, optimistic, ...rest]
    })
    setDraft("")
    setPosting(true)
    try {
      const res = await fetch(`/api/lessons/${lessonId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error()
      const saved = await res.json()
      setQuestions((qs) =>
        qs.map((q) =>
          q.id === tempId ? { ...saved, answeredByInstructor: false, answers: [] } : q
        )
      )
      toast.success(t("questionPosted"))
    } catch {
      setQuestions((qs) => qs.filter((q) => q.id !== tempId))
      setDraft(content)
      toast.error(t("postError"))
    } finally {
      setPosting(false)
    }
  }

  const reply = async (questionId: string) => {
    const content = (replyDrafts[questionId] ?? "").trim()
    if (!content) return
    const tempId = `temp-${Date.now()}`
    const optimistic: QAAnswer = {
      id: tempId,
      content,
      userId: me.id,
      createdAt: new Date().toISOString(),
      user: me,
      isInstructor,
      pending: true,
    }
    const patch = (fn: (q: QAQuestion) => QAQuestion) =>
      setQuestions((qs) => qs.map((q) => (q.id === questionId ? fn(q) : q)))

    patch((q) => ({
      ...q,
      answers: [...q.answers, optimistic],
      answeredByInstructor: q.answeredByInstructor || isInstructor,
    }))
    setReplyDrafts((d) => ({ ...d, [questionId]: "" }))
    setReplyOpen(null)
    try {
      const res = await fetch(`/api/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error()
      const saved: QAAnswer = await res.json()
      patch((q) => ({
        ...q,
        answers: q.answers.map((a) => (a.id === tempId ? saved : a)),
        answeredByInstructor: q.answers.some((a) => a.id !== tempId && a.isInstructor) || saved.isInstructor,
      }))
    } catch {
      patch((q) => {
        const answers = q.answers.filter((a) => a.id !== tempId)
        return { ...q, answers, answeredByInstructor: answers.some((a) => a.isInstructor) }
      })
      setReplyDrafts((d) => ({ ...d, [questionId]: content }))
      setReplyOpen(questionId)
      toast.error(t("postError"))
    }
  }

  const visible = questions.filter((q) =>
    filter === "mine"
      ? q.userId === me.id
      : filter === "unanswered"
        ? !q.answeredByInstructor
        : true
  )

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: t("filterAll") },
    { value: "mine", label: t("filterMine") },
    { value: "unanswered", label: t("filterUnanswered") },
  ]

  return (
    <section id="lesson-questions" className={cn("scroll-mt-6", className)}>
      <SectionCard
        icon={MessageCircleQuestion}
        title={
          <span className="inline-flex items-center gap-2">
            {t("title")}
            {status === "ready" && questions.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {questions.length}
              </span>
            )}
          </span>
        }
        description={isInstructor ? t("descriptionInstructor") : t("description")}
      >
        <div className="space-y-5">
          {/* Ask form */}
          <form onSubmit={ask} className="space-y-2">
            <label htmlFor={`ask-${lessonId}`} className="sr-only">
              {t("askLabel")}
            </label>
            <Textarea
              id={`ask-${lessonId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={t("askPlaceholder")}
              rows={3}
              className="resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t("askHint")}</p>
              <Button type="submit" size="sm" disabled={!draft.trim() || posting}>
                {posting ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="rtl:-scale-x-100" aria-hidden="true" />
                )}
                {t("ask")}
              </Button>
            </div>
          </form>

          {/* Filters */}
          {status === "ready" && questions.length > 0 && (
            <div role="tablist" aria-label={t("filterLabel")} className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    filter === f.value
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          {status === "loading" ? (
            <ListSkeleton rows={3} />
          ) : status === "error" ? (
            <EmptyState
              size="sm"
              icon={MessageCircleQuestion}
              title={t("loadError")}
              action={
                <Button variant="outline" size="sm" onClick={load}>
                  <RotateCw aria-hidden="true" />
                  {t("retry")}
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              size="sm"
              icon={MessageCircleQuestion}
              title={questions.length === 0 ? t("emptyTitle") : t("emptyFiltered")}
              description={questions.length === 0 ? t("emptyDescription") : undefined}
            />
          ) : (
            <ul className="space-y-3">
              {visible.map((q) => {
                const replyValue = replyDrafts[q.id] ?? ""
                return (
                  <li
                    key={q.id}
                    className={cn(
                      "rounded-lg border bg-card p-4 transition-opacity",
                      q.pending && "opacity-60"
                    )}
                    aria-busy={q.pending || undefined}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <AvatarName
                        size="sm"
                        name={q.user.name}
                        image={q.user.image}
                        secondary={q.pending ? t("sending") : relTime(q.createdAt)}
                        badge={
                          q.userId === me.id ? (
                            <span className="text-xs text-muted-foreground">({t("you")})</span>
                          ) : undefined
                        }
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {q.isPinned && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Pin className="h-3 w-3" aria-hidden="true" />
                            {t("pinned")}
                          </span>
                        )}
                        {q.answeredByInstructor ? (
                          <StatusBadge status="ANSWERED" label={t("answeredByTeacher")} />
                        ) : (
                          !q.pending && <StatusBadge status="UNANSWERED" label={t("awaitingAnswer")} />
                        )}
                      </div>
                    </div>

                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">
                      {q.content}
                    </p>

                    {q.answers.length > 0 && (
                      <ul className="mt-4 space-y-2 border-s-2 border-border ps-3 sm:ps-4">
                        {q.answers.map((a) => (
                          <li
                            key={a.id}
                            className={cn(
                              "rounded-md p-3 transition-opacity",
                              a.isInstructor
                                ? "border border-primary/20 bg-primary/5"
                                : "bg-muted/50",
                              a.pending && "opacity-60"
                            )}
                          >
                            <AvatarName
                              size="sm"
                              name={a.user.name}
                              image={a.user.image}
                              secondary={a.pending ? t("sending") : relTime(a.createdAt)}
                              badge={
                                a.isInstructor ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">
                                    <GraduationCap className="h-3 w-3" aria-hidden="true" />
                                    {t("teacher")}
                                  </span>
                                ) : undefined
                              }
                            />
                            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">
                              {a.content}
                            </p>
                            {a.isInstructor && !a.pending && (
                              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {t("officialAnswer")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!q.pending && (
                      <div className="mt-3">
                        {replyOpen === q.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              reply(q.id)
                            }}
                            className="space-y-2"
                          >
                            <label htmlFor={`reply-${q.id}`} className="sr-only">
                              {t("replyLabel")}
                            </label>
                            <Textarea
                              id={`reply-${q.id}`}
                              autoFocus
                              rows={2}
                              value={replyValue}
                              onChange={(e) =>
                                setReplyDrafts((d) => ({
                                  ...d,
                                  [q.id]: e.target.value.slice(0, MAX_LEN),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                  e.preventDefault()
                                  e.currentTarget.form?.requestSubmit()
                                }
                                if (e.key === "Escape") setReplyOpen(null)
                              }}
                              placeholder={isInstructor ? t("answerPlaceholder") : t("replyPlaceholder")}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setReplyOpen(null)}
                              >
                                {t("cancel")}
                              </Button>
                              <Button type="submit" size="sm" disabled={!replyValue.trim()}>
                                <CornerDownLeft className="rtl:-scale-x-100" aria-hidden="true" />
                                {t("sendReply")}
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="-ms-2 text-muted-foreground"
                            onClick={() => setReplyOpen(q.id)}
                          >
                            <MessageSquareReply aria-hidden="true" />
                            {isInstructor ? t("answer") : t("reply")}
                            {q.answers.length > 0 && (
                              <span className="tabular-nums">· {t("replies", { count: q.answers.length })}</span>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </SectionCard>
    </section>
  )
}
