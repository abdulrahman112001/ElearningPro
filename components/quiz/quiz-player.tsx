"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import toast from "react-hot-toast"
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface QuizOption {
  id: string
  text: string
  textAr?: string
}

interface QuizQuestion {
  id: string
  question: string
  questionAr?: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT"
  options: QuizOption[]
  points: number
}

interface Quiz {
  id: string
  titleEn: string
  titleAr?: string
  description?: string
  passingScore: number
  timeLimit?: number
  shuffleQuestions: boolean
  questions: QuizQuestion[]
}

interface QuizResult {
  questionId: string
  question: string
  questionAr?: string
  userAnswer: string | string[]
  isCorrect: boolean
  correctAnswer: string[]
  explanation?: string
  explanationAr?: string
}

interface QuizPlayerProps {
  lessonId: string
  onComplete?: (passed: boolean) => void
}

export function QuizPlayer({ lessonId, onComplete }: QuizPlayerProps) {
  const t = useTranslations("quiz")
  const locale = useLocale()
  const router = useRouter()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [startedAt] = useState(new Date())
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [result, setResult] = useState<{
    score: number
    passed: boolean
    passingScore: number
    correctAnswers: number
    totalQuestions: number
    results?: QuizResult[]
  } | null>(null)

  // Fetch quiz
  useEffect(() => {
    fetchQuiz()
  }, [lessonId])

  // Timer
  useEffect(() => {
    if (!quiz?.timeLimit || isCompleted) return

    setTimeRemaining(quiz.timeLimit * 60)

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [quiz?.timeLimit, isCompleted])

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`/api/quizzes/${lessonId}`)
      if (!response.ok) throw new Error("Failed to load quiz")

      const data = await response.json()

      // Shuffle questions if enabled
      if (data.shuffleQuestions) {
        data.questions = shuffleArray(data.questions)
      }

      setQuiz(data)
    } catch (error) {
      toast.error(t("loadError"))
    } finally {
      setLoading(false)
    }
  }

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleMultiSelect = (
    questionId: string,
    optionId: string,
    checked: boolean
  ) => {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) || []
      if (checked) {
        return { ...prev, [questionId]: [...current, optionId] }
      } else {
        return {
          ...prev,
          [questionId]: current.filter((id) => id !== optionId),
        }
      }
    })
  }

  const handleSubmit = async () => {
    if (!quiz) return

    setSubmitting(true)

    try {
      const timeSpent = Math.floor((Date.now() - startedAt.getTime()) / 1000)

      const response = await fetch(`/api/quizzes/${lessonId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          startedAt: startedAt.toISOString(),
          timeSpent,
        }),
      })

      if (!response.ok) throw new Error("Failed to submit quiz")

      const data = await response.json()
      setResult(data)
      setIsCompleted(true)
      onComplete?.(data.passed)
    } catch (error) {
      toast.error(t("submitError"))
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getProgress = () => {
    if (!quiz) return 0
    return (Object.keys(answers).length / quiz.questions.length) * 100
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!quiz) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("notFound")}</p>
        </CardContent>
      </Card>
    )
  }

  // Show results
  if (isCompleted && result) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div
            className={cn(
              "w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4",
              result.passed
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600"
            )}
          >
            {result.passed ? (
              <CheckCircle className="h-10 w-10" />
            ) : (
              <XCircle className="h-10 w-10" />
            )}
          </div>
          <CardTitle
            className={result.passed ? "text-green-600" : "text-red-600"}
          >
            {result.passed ? t("passed") : t("failed")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-3xl font-bold">{Math.round(result.score)}%</p>
              <p className="text-sm text-muted-foreground">{t("yourScore")}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-3xl font-bold">
                {result.correctAnswers}/{result.totalQuestions}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("correctAnswers")}
              </p>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {t("passingScore")}: {result.passingScore}%
          </div>

          {/* Detailed Results */}
          {result.results && (
            <div className="space-y-4 mt-8">
              <h3 className="font-semibold">{t("reviewAnswers")}</h3>
              {result.results.map((r, index) => (
                <div
                  key={r.questionId}
                  className={cn(
                    "p-4 rounded-lg border",
                    r.isCorrect
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {r.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {index + 1}.{" "}
                        {locale === "ar" && r.questionAr
                          ? r.questionAr
                          : r.question}
                      </p>
                      {r.explanation && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {locale === "ar" && r.explanationAr
                            ? r.explanationAr
                            : r.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-center pt-4">
            {!result.passed && (
              <Button
                onClick={() => {
                  setIsCompleted(false)
                  setResult(null)
                  setAnswers({})
                  setCurrentQuestion(0)
                  fetchQuiz()
                }}
              >
                <RotateCcw className="me-2 h-4 w-4" />
                {t("tryAgain")}
              </Button>
            )}
            <Button variant="outline" onClick={() => router.back()}>
              {t("backToLesson")}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const question = quiz.questions[currentQuestion]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {locale === "ar" && quiz.titleAr ? quiz.titleAr : quiz.titleEn}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("question")} {currentQuestion + 1} / {quiz.questions.length}
          </p>
        </div>

        {timeRemaining !== null && (
          <Badge
            variant={timeRemaining < 60 ? "destructive" : "secondary"}
            className="text-lg px-3 py-1"
          >
            <Clock className="me-2 h-4 w-4" />
            {formatTime(timeRemaining)}
          </Badge>
        )}
      </div>

      {/* Progress */}
      <Progress value={getProgress()} className="h-2" />

      {/* Question */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {question.points} {t("points")}
            </Badge>
            <Badge variant="outline">
              {question.type === "MULTIPLE_CHOICE" && t("multipleChoice")}
              {question.type === "TRUE_FALSE" && t("trueFalse")}
              {question.type === "MULTIPLE_SELECT" && t("multipleSelect")}
            </Badge>
          </div>
          <CardTitle className="text-lg mt-4">
            {locale === "ar" && question.questionAr
              ? question.questionAr
              : question.question}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {question.type === "MULTIPLE_CHOICE" ||
          question.type === "TRUE_FALSE" ? (
            <RadioGroup
              value={(answers[question.id] as string) || ""}
              onValueChange={(value) => handleAnswer(question.id, value)}
              className="space-y-3"
            >
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted transition-colors"
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                    {locale === "ar" && option.textAr
                      ? option.textAr
                      : option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <div className="space-y-3">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted transition-colors"
                >
                  <Checkbox
                    id={option.id}
                    checked={(
                      (answers[question.id] as string[]) || []
                    ).includes(option.id)}
                    onCheckedChange={(checked) =>
                      handleMultiSelect(
                        question.id,
                        option.id,
                        checked as boolean
                      )
                    }
                  />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                    {locale === "ar" && option.textAr
                      ? option.textAr
                      : option.text}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestion((prev) => prev - 1)}
          disabled={currentQuestion === 0}
        >
          <ChevronLeft className="me-2 h-4 w-4" />
          {t("previous")}
        </Button>

        <div className="flex gap-2">
          {quiz.questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestion(index)}
              className={cn(
                "w-8 h-8 rounded-full text-sm font-medium transition-colors",
                currentQuestion === index
                  ? "bg-primary text-primary-foreground"
                  : answers[quiz.questions[index].id]
                  ? "bg-green-100 text-green-700"
                  : "bg-muted"
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {currentQuestion === quiz.questions.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || Object.keys(answers).length < quiz.questions.length
            }
          >
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        ) : (
          <Button onClick={() => setCurrentQuestion((prev) => prev + 1)}>
            {t("next")}
            <ChevronRight className="ms-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
