"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  Flag,
  Loader2,
  AlertTriangle,
  CalendarClock,
  EyeOff,
  Lock,
} from "lucide-react"
import toast from "react-hot-toast"
import { formatCairo } from "@/components/exams/cairo-time"

interface QuizOption {
  id: string
  text: string
  textAr?: string
}

interface QuizQuestion {
  id: string
  question: string
  questionAr?: string | null
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT" | "ESSAY"
  points: number
  imageUrl?: string | null
  options: QuizOption[]
}

interface QuizData {
  id: string
  title: string
  titleAr?: string | null
  description?: string | null
  passingScore: number
  timeLimit?: number | null
  questionCount: number
  availableFrom?: string | null
  availableUntil?: string | null
  maxAttempts?: number | null
  detectTabSwitch: boolean
  hasEssay: boolean
}

interface ResumeData {
  attemptId: string
  deadline: string | null
  tabSwitches: number
  questions: QuizQuestion[]
}

interface QuizClientProps {
  quiz: QuizData
  lessonId: string
  courseSlug: string
  resume?: ResumeData
  /** Submitted attempts */
  attemptsCount: number
  /** All attempts counted against maxAttempts */
  attemptsUsed: number
}

type Answer = string | string[]

export function QuizClient({ quiz, lessonId, courseSlug, resume, attemptsCount, attemptsUsed }: QuizClientProps) {
  const router = useRouter()
  const t = useTranslations("quizClient")
  const tQuiz = useTranslations("quiz")
  const te = useTranslations("exams")
  const tc = useTranslations("common")
  const locale = useLocale()
  const isAr = locale === "ar"
  const quizTitle = isAr ? quiz.titleAr || quiz.title : quiz.title || quiz.titleAr

  const [attemptId, setAttemptId] = useState<string | undefined>(resume?.attemptId)
  const [questions, setQuestions] = useState<QuizQuestion[]>(resume?.questions ?? [])
  const [deadline, setDeadline] = useState<number | null>(resume?.deadline ? Date.parse(resume.deadline) : null)
  const [tabSwitches, setTabSwitches] = useState(resume?.tabSwitches ?? 0)
  const [isStarted, setIsStarted] = useState(!!resume)
  const [isStarting, setIsStarting] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => Date.now())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const warnedRef = useRef(false)
  const submittingRef = useRef(false)

  const currentQuestion = questions[currentQuestionIndex]
  const isAnswered = (a: Answer | undefined) =>
    Array.isArray(a) ? a.length > 0 : typeof a === "string" && a.trim().length > 0
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length
  const progress = questions.length ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0
  const timeRemaining = deadline !== null ? Math.max(0, Math.floor((deadline - now) / 1000)) : null

  // Pre-start window / attempts state
  const opensAt = quiz.availableFrom ? Date.parse(quiz.availableFrom) : null
  const closesAt = quiz.availableUntil ? Date.parse(quiz.availableUntil) : null
  const notOpen = opensAt !== null && now < opensAt
  const closed = closesAt !== null && now > closesAt
  const exhausted = !!quiz.maxAttempts && attemptsUsed >= quiz.maxAttempts

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || !attemptId) return
    submittingRef.current = true
    setIsSubmitting(true)
    setShowSubmitDialog(false)

    const resultUrl = `/courses/${courseSlug}/lessons/${lessonId}/quiz/result?attemptId=${attemptId}`
    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (data.code === "time_limit_exceeded" || data.code === "already_submitted") {
          toast.error(te(`client.${data.code === "time_limit_exceeded" ? "timeUp" : "alreadySubmitted"}`))
          router.push(resultUrl)
          return
        }
        throw new Error("Failed to submit quiz")
      }
      router.push(data.resultUrl ?? resultUrl)
    } catch {
      toast.error(t("submitError"))
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }, [attemptId, answers, courseSlug, lessonId, router, t, te])

  // Auto-submit when the time is up; warn one minute before.
  const submitRef = useRef(handleSubmit)
  submitRef.current = handleSubmit
  useEffect(() => {
    if (!isStarted || timeRemaining === null) return
    if (timeRemaining <= 0) {
      submitRef.current()
    } else if (timeRemaining <= 60 && !warnedRef.current) {
      warnedRef.current = true
      toast.error(t("oneMinuteLeft"))
    }
  }, [isStarted, timeRemaining, t])

  // Tab-switch detection
  useEffect(() => {
    if (!isStarted || !attemptId || !quiz.detectTabSwitch) return
    let last = 0
    const report = () => {
      if (submittingRef.current) return
      const ts = Date.now()
      if (ts - last < 2000) return // visibilitychange + blur fire together
      last = ts
      fetch(`/api/quiz/attempts/${attemptId}/tab-switch`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.tabSwitches === "number") setTabSwitches(data.tabSwitches)
        })
        .catch(() => {})
      toast.error(te("client.tabSwitchWarning"), { id: "tab-switch", duration: 5000 })
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") report()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("blur", report)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("blur", report)
    }
  }, [isStarted, attemptId, quiz.detectTabSwitch, te])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    const mmss = `${mins.toString().padStart(h ? 2 : 1, "0")}:${secs.toString().padStart(2, "0")}`
    return h ? `${h}:${mmss}` : mmss
  }

  const startQuiz = async () => {
    setIsStarting(true)
    try {
      const response = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (data.code === "exam_not_open") {
          toast.error(te("client.notOpenToast", { date: formatCairo(data.opensAt, locale) }))
        } else if (data.code === "exam_closed") {
          toast.error(te("client.closed"))
        } else if (data.code === "max_attempts_reached") {
          toast.error(te("client.noAttemptsLeft"))
        } else {
          toast.error(t("startError"))
        }
        router.refresh()
        return
      }
      setAttemptId(data.attemptId)
      setQuestions(data.questions)
      setDeadline(data.deadline ? Date.parse(data.deadline) : null)
      setCurrentQuestionIndex(0)
      setIsStarted(true)
    } catch {
      toast.error(t("startError"))
    } finally {
      setIsStarting(false)
    }
  }

  const handleAnswer = (questionId: string, answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  if (!isStarted || !currentQuestion) {
    const blocked = notOpen || closed || exhausted
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{quizTitle}</CardTitle>
            {quiz.description && <p className="mt-2 text-muted-foreground">{quiz.description}</p>}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-2xl font-bold">{quiz.questionCount}</div>
                <div className="text-sm text-muted-foreground">{t("questionsLabel")}</div>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-2xl font-bold">{quiz.passingScore}%</div>
                <div className="text-sm text-muted-foreground">{t("passingScoreLabel")}</div>
              </div>
              {quiz.timeLimit && (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <div className="text-2xl font-bold">{quiz.timeLimit}</div>
                  <div className="text-sm text-muted-foreground">{t("minutesLabel")}</div>
                </div>
              )}
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-2xl font-bold">
                  {quiz.maxAttempts ? `${attemptsUsed}/${quiz.maxAttempts}` : attemptsCount}
                </div>
                <div className="text-sm text-muted-foreground">
                  {quiz.maxAttempts ? te("client.attemptsUsed") : t("previousAttempts")}
                </div>
              </div>
            </div>

            {(opensAt || closesAt) && (
              <div className="space-y-1 rounded-lg border p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  {te("client.window")}
                </div>
                {opensAt && (
                  <p className="text-muted-foreground">{te("client.opensAt", { date: formatCairo(quiz.availableFrom, locale) })}</p>
                )}
                {closesAt && (
                  <p className="text-muted-foreground">{te("client.closesAt", { date: formatCairo(quiz.availableUntil, locale) })}</p>
                )}
              </div>
            )}

            <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                {t("instructionsTitle")}
              </h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>{t("instructions.readCarefully")}</li>
                <li>{t("instructions.navigateFreely")}</li>
                <li>{t("instructions.flagForReview")}</li>
                {quiz.timeLimit && <li>{t("instructions.timeLimit", { minutes: quiz.timeLimit })}</li>}
                {quiz.detectTabSwitch && <li>{te("client.tabSwitchNotice")}</li>}
                {quiz.hasEssay && <li>{te("client.essayNotice")}</li>}
                <li>{t("instructions.reviewBeforeSubmit")}</li>
              </ul>
            </div>

            {blocked ? (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-4 text-center text-sm font-medium">
                <Lock className="h-4 w-4" />
                {notOpen
                  ? te("client.notOpen", { date: formatCairo(quiz.availableFrom, locale) })
                  : closed
                    ? te("client.closed")
                    : te("client.noAttemptsLeft")}
              </div>
            ) : (
              <Button onClick={startQuiz} className="w-full" size="lg" disabled={isStarting}>
                {isStarting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {tQuiz("startQuiz")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const optionLabel = (o: QuizOption) => (isAr ? o.textAr || o.text : o.text || o.textAr)

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{quizTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t("questionProgress", { current: currentQuestionIndex + 1, total: questions.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {quiz.detectTabSwitch && tabSwitches > 0 && (
            <Badge variant="destructive" className="gap-1.5 px-3 py-1.5">
              <EyeOff className="h-4 w-4" />
              {te("client.tabSwitchCount", { count: tabSwitches })}
            </Badge>
          )}
          {timeRemaining !== null && (
            <Badge variant={timeRemaining < 60 ? "destructive" : "secondary"} className="gap-2 px-4 py-2 text-lg tabular-nums">
              <Clock className="h-4 w-4" />
              {formatTime(timeRemaining)}
            </Badge>
          )}
        </div>
      </div>

      <Progress value={progress} className="mb-6 h-2" />

      {/* Question navigation */}
      <div className="mb-6 flex flex-wrap gap-1">
        {questions.map((q, index) => (
          <Button
            key={q.id}
            variant={currentQuestionIndex === index ? "default" : isAnswered(answers[q.id]) ? "secondary" : "outline"}
            size="sm"
            className={`h-10 w-10 ${flaggedQuestions.has(q.id) ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setCurrentQuestionIndex(index)}
            aria-label={t("goToQuestion", { number: index + 1 })}
            aria-current={currentQuestionIndex === index ? "step" : undefined}
          >
            {index + 1}
          </Button>
        ))}
      </div>

      {/* Question card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="outline">{t("pointsCount", { count: currentQuestion.points })}</Badge>
                {currentQuestion.type === "ESSAY" && <Badge variant="secondary">{te("types.ESSAY")}</Badge>}
                {currentQuestion.type === "MULTIPLE_SELECT" && (
                  <Badge variant="secondary">{te("client.selectAll")}</Badge>
                )}
              </div>
              {currentQuestion.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentQuestion.imageUrl}
                  alt=""
                  className="mb-3 max-h-80 max-w-full rounded-md border object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
              <CardTitle className="whitespace-pre-line text-lg leading-relaxed" dir="auto">
                {isAr
                  ? currentQuestion.questionAr || currentQuestion.question
                  : currentQuestion.question || currentQuestion.questionAr}
              </CardTitle>
            </div>
            <Button
              variant={flaggedQuestions.has(currentQuestion.id) ? "default" : "ghost"}
              size="icon"
              onClick={() => toggleFlag(currentQuestion.id)}
              title={t("flagForReview")}
              aria-label={t("flagForReview")}
              aria-pressed={flaggedQuestions.has(currentQuestion.id)}
            >
              <Flag className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {currentQuestion.type === "ESSAY" ? (
            <div className="space-y-2">
              <Textarea
                value={(answers[currentQuestion.id] as string) || ""}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                rows={8}
                maxLength={20000}
                dir="auto"
                placeholder={te("client.essayPlaceholder")}
                aria-label={te("client.essayPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{te("client.essayHint")}</p>
            </div>
          ) : currentQuestion.type === "MULTIPLE_SELECT" ? (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                const selected = (answers[currentQuestion.id] as string[]) || []
                const checked = selected.includes(option.id)
                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        handleAnswer(
                          currentQuestion.id,
                          checked ? selected.filter((a) => a !== option.id) : [...selected, option.id]
                        )
                      }
                    />
                    <span className="flex-1">{optionLabel(option)}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <RadioGroup
              value={(answers[currentQuestion.id] as string) || ""}
              onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
                  onClick={() => handleAnswer(currentQuestion.id, option.id)}
                >
                  <RadioGroupItem value={option.id} id={`${currentQuestion.id}-${option.id}`} />
                  <Label htmlFor={`${currentQuestion.id}-${option.id}`} className="flex-1 cursor-pointer">
                    {optionLabel(option)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronRight className="me-2 h-4 w-4 ltr:rotate-180" />
          {tc("previous")}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          {t("answeredProgress", { answered: answeredCount, total: questions.length })}
        </div>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button onClick={() => setShowSubmitDialog(true)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {tQuiz("submitQuiz")}
          </Button>
        ) : (
          <Button onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}>
            {tc("next")}
            <ChevronLeft className="ms-2 h-4 w-4 ltr:rotate-180" />
          </Button>
        )}
      </div>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmSubmitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {answeredCount < questions.length ? (
                <span className="text-yellow-600">
                  {t("unansweredWarning", { count: questions.length - answeredCount })}
                </span>
              ) : (
                t("confirmSubmitDescription")
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tQuiz("reviewAnswers")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>{tQuiz("submitQuiz")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
