"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
} from "lucide-react"
import toast from "react-hot-toast"

interface QuizOption {
  id: string
  text: string
  textAr?: string
}

interface QuizQuestion {
  id: string
  question: string
  questionAr?: string | null
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT"
  points: number
  options: QuizOption[]
}

interface QuizData {
  id: string
  title: string
  titleAr?: string | null
  description?: string | null
  passingScore: number
  timeLimit?: number | null
  shuffleQuestions: boolean
  questions: QuizQuestion[]
}

interface QuizClientProps {
  quiz: QuizData
  lessonId: string
  courseSlug: string
  existingAttemptId?: string
  attemptsCount: number
}

export function QuizClient({
  quiz,
  lessonId,
  courseSlug,
  existingAttemptId,
  attemptsCount,
}: QuizClientProps) {
  const router = useRouter()
  const [isStarted, setIsStarted] = useState(!!existingAttemptId)
  const [attemptId, setAttemptId] = useState(existingAttemptId)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(
    new Set()
  )
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    quiz.timeLimit ? quiz.timeLimit * 60 : null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [showTimeWarning, setShowTimeWarning] = useState(false)

  const questions = quiz.shuffleQuestions
    ? [...quiz.questions].sort(() => Math.random() - 0.5)
    : quiz.questions

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const answeredCount = Object.keys(answers).length

  // Timer
  useEffect(() => {
    if (!isStarted || timeRemaining === null) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null
        if (prev <= 0) {
          handleSubmit()
          return 0
        }
        if (prev === 60 && !showTimeWarning) {
          setShowTimeWarning(true)
          toast.error("باقي دقيقة واحدة!")
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isStarted, timeRemaining, showTimeWarning])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startQuiz = async () => {
    try {
      const response = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id }),
      })

      if (!response.ok) throw new Error("Failed to start quiz")

      const data = await response.json()
      setAttemptId(data.attemptId)
      setIsStarted(true)
    } catch (error) {
      toast.error("حدث خطأ أثناء بدء الاختبار")
    }
  }

  const handleAnswer = (questionId: string, answer: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setShowSubmitDialog(false)

    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      })

      if (!response.ok) throw new Error("Failed to submit quiz")

      const data = await response.json()
      router.push(
        `/courses/${courseSlug}/lessons/${lessonId}/quiz/result?attemptId=${data.attemptId}`
      )
    } catch (error) {
      toast.error("حدث خطأ أثناء تسليم الاختبار")
      setIsSubmitting(false)
    }
  }, [attemptId, answers, courseSlug, lessonId, router, isSubmitting])

  if (!isStarted) {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {quiz.titleAr || quiz.title}
            </CardTitle>
            {quiz.description && (
              <p className="text-muted-foreground mt-2">{quiz.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{questions.length}</div>
                <div className="text-sm text-muted-foreground">سؤال</div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{quiz.passingScore}%</div>
                <div className="text-sm text-muted-foreground">درجة النجاح</div>
              </div>
              {quiz.timeLimit && (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{quiz.timeLimit}</div>
                  <div className="text-sm text-muted-foreground">دقيقة</div>
                </div>
              )}
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{attemptsCount}</div>
                <div className="text-sm text-muted-foreground">
                  محاولة سابقة
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                تعليمات الاختبار
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>اقرأ كل سؤال بعناية قبل الإجابة</li>
                <li>يمكنك التنقل بين الأسئلة بحرية</li>
                <li>يمكنك وضع علامة على الأسئلة للمراجعة لاحقاً</li>
                {quiz.timeLimit && (
                  <li>لديك {quiz.timeLimit} دقيقة لإكمال الاختبار</li>
                )}
                <li>تأكد من مراجعة إجاباتك قبل التسليم</li>
              </ul>
            </div>

            <Button onClick={startQuiz} className="w-full" size="lg">
              بدء الاختبار
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{quiz.titleAr || quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            السؤال {currentQuestionIndex + 1} من {questions.length}
          </p>
        </div>
        {timeRemaining !== null && (
          <Badge
            variant={timeRemaining < 60 ? "destructive" : "secondary"}
            className="text-lg px-4 py-2"
          >
            <Clock className="h-4 w-4 ms-2" />
            {formatTime(timeRemaining)}
          </Badge>
        )}
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2 mb-6" />

      {/* Question Navigation */}
      <div className="flex gap-1 flex-wrap mb-6">
        {questions.map((q, index) => (
          <Button
            key={q.id}
            variant={
              currentQuestionIndex === index
                ? "default"
                : answers[q.id]
                ? "secondary"
                : "outline"
            }
            size="sm"
            className={`w-10 h-10 ${
              flaggedQuestions.has(q.id) ? "ring-2 ring-yellow-500" : ""
            }`}
            onClick={() => setCurrentQuestionIndex(index)}
          >
            {index + 1}
          </Button>
        ))}
      </div>

      {/* Question Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">
                {currentQuestion.points} نقطة
              </Badge>
              <CardTitle className="text-lg">
                {currentQuestion.questionAr || currentQuestion.question}
              </CardTitle>
            </div>
            <Button
              variant={
                flaggedQuestions.has(currentQuestion.id) ? "default" : "ghost"
              }
              size="icon"
              onClick={() => toggleFlag(currentQuestion.id)}
              title="وضع علامة للمراجعة"
            >
              <Flag className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {currentQuestion.type === "MULTIPLE_SELECT" ? (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                const selectedAnswers =
                  (answers[currentQuestion.id] as string[]) || []
                return (
                  <div
                    key={option.id}
                    className="flex items-center space-x-3 space-x-reverse p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      const newAnswers = selectedAnswers.includes(option.id)
                        ? selectedAnswers.filter((a) => a !== option.id)
                        : [...selectedAnswers, option.id]
                      handleAnswer(currentQuestion.id, newAnswers)
                    }}
                  >
                    <Checkbox
                      checked={selectedAnswers.includes(option.id)}
                      onCheckedChange={() => {}}
                    />
                    <Label className="flex-1 cursor-pointer">
                      {option.textAr || option.text}
                    </Label>
                  </div>
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
                  className="flex items-center space-x-3 space-x-reverse p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleAnswer(currentQuestion.id, option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                    {option.textAr || option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronRight className="h-4 w-4 ms-2" />
          السابق
        </Button>

        <div className="text-sm text-muted-foreground">
          {answeredCount} من {questions.length} تم الإجابة عليها
        </div>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button
            onClick={() => setShowSubmitDialog(true)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin ms-2" />
            ) : null}
            تسليم الاختبار
          </Button>
        ) : (
          <Button onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}>
            التالي
            <ChevronLeft className="h-4 w-4 me-2" />
          </Button>
        )}
      </div>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تسليم الاختبار</AlertDialogTitle>
            <AlertDialogDescription>
              {answeredCount < questions.length ? (
                <span className="text-yellow-600">
                  تنبيه: لم تجب على {questions.length - answeredCount} سؤال
                </span>
              ) : (
                "هل أنت متأكد من تسليم الاختبار؟ لا يمكنك تغيير إجاباتك بعد التسليم."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>مراجعة الإجابات</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              تسليم الاختبار
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
