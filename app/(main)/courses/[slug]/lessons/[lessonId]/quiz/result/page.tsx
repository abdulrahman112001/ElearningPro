import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  XCircle,
  Trophy,
  RefreshCw,
  ArrowRight,
  Clock,
  Target,
  Award,
} from "lucide-react"

interface QuizResultPageProps {
  params: {
    slug: string
    lessonId: string
  }
  searchParams: {
    attemptId?: string
  }
}

export async function generateMetadata() {
  const t = await getTranslations("quiz")
  return {
    title: t("quizResult"),
  }
}

export default async function QuizResultPage({
  params,
  searchParams,
}: QuizResultPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const t = await getTranslations("quiz")

  if (!searchParams.attemptId) {
    redirect(`/courses/${params.slug}/lessons/${params.lessonId}`)
  }

  // Get attempt with details
  const attempt = await db.quizAttempt.findUnique({
    where: { id: searchParams.attemptId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { position: "asc" },
          },
          lesson: {
            select: {
              titleEn: true,
              titleAr: true,
              chapter: {
                select: {
                  course: {
                    select: {
                      titleEn: true,
                      titleAr: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      answers: {
        include: {
          question: true,
        },
      },
    },
  })

  if (!attempt || attempt.userId !== session.user.id) {
    notFound()
  }

  const quiz = attempt.quiz
  const lesson = quiz.lesson
  const course = lesson.chapter.course

  const totalQuestions = quiz.questions.length
  const correctAnswers = attempt.answers.filter((a) => a.isCorrect).length
  const wrongAnswers = totalQuestions - correctAnswers
  const timeSpentMinutes = attempt.timeSpent
    ? Math.floor(attempt.timeSpent / 60)
    : 0
  const timeSpentSeconds = attempt.timeSpent ? attempt.timeSpent % 60 : 0

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-4xl">
        {/* Result Header */}
        <Card className="mb-6 overflow-hidden">
          <div
            className={`p-8 text-center text-white ${
              attempt.passed
                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                : "bg-gradient-to-r from-red-500 to-rose-600"
            }`}
          >
            {attempt.passed ? (
              <Trophy className="h-16 w-16 mx-auto mb-4" />
            ) : (
              <XCircle className="h-16 w-16 mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-bold mb-2">
              {attempt.passed ? t("congratulations") : t("tryAgain")}
            </h1>
            <p className="text-lg opacity-90">
              {attempt.passed ? t("passedMessage") : t("failedMessage")}
            </p>
          </div>

          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="text-5xl font-bold mb-2">
                {Math.round(attempt.score)}%
              </div>
              <p className="text-muted-foreground">
                {t("passingScore")}: {quiz.passingScore}%
              </p>
            </div>

            <Progress value={attempt.score} className="h-3 mb-6" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <Target className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{totalQuestions}</div>
                <div className="text-sm text-muted-foreground">
                  {t("totalQuestions")}
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold text-green-600">
                  {correctAnswers}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("correctAnswers")}
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <XCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                <div className="text-2xl font-bold text-red-600">
                  {wrongAnswers}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("wrongAnswers")}
                </div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">
                  {timeSpentMinutes}:
                  {timeSpentSeconds.toString().padStart(2, "0")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("timeSpent")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Answers Review */}
        {quiz.showResults && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("answersReview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quiz.questions.map((question, index) => {
                const answer = attempt.answers.find(
                  (a) => a.questionId === question.id
                )
                const options = question.options as any[]
                const correctOption = options.find((o) => o.isCorrect)
                const selectedOptionId = answer?.answer as string

                return (
                  <div
                    key={question.id}
                    className={`p-4 rounded-lg border ${
                      answer?.isCorrect
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          answer?.isCorrect
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {answer?.isCorrect ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium mb-2">
                          {index + 1}.{" "}
                          {question.questionAr || question.question}
                        </p>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            <span className="font-medium">
                              {t("yourAnswer")}:
                            </span>{" "}
                            {options.find((o) => o.id === selectedOptionId)
                              ?.textAr ||
                              options.find((o) => o.id === selectedOptionId)
                                ?.text ||
                              t("notAnswered")}
                          </p>
                          {!answer?.isCorrect && (
                            <p className="text-green-600 dark:text-green-400">
                              <span className="font-medium">
                                {t("correctAnswer")}:
                              </span>{" "}
                              {correctOption?.textAr || correctOption?.text}
                            </p>
                          )}
                          {question.explanationAr || question.explanation ? (
                            <p className="mt-2 text-muted-foreground italic">
                              <span className="font-medium">
                                {t("explanation")}:
                              </span>{" "}
                              {question.explanationAr || question.explanation}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Badge
                        variant={answer?.isCorrect ? "default" : "destructive"}
                      >
                        {answer?.points || 0}/{question.points} {t("points")}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {!attempt.passed && (
            <Button size="lg" asChild>
              <Link
                href={`/courses/${params.slug}/lessons/${params.lessonId}/quiz`}
              >
                <RefreshCw className="h-5 w-5 ms-2" />
                {t("retakeQuiz")}
              </Link>
            </Button>
          )}
          <Button variant="outline" size="lg" asChild>
            <Link href={`/courses/${params.slug}/learn`}>
              {t("backToCourse")}
              <ArrowRight className="h-5 w-5 me-2" />
            </Link>
          </Button>
          {attempt.passed && (
            <Button variant="secondary" size="lg" asChild>
              <Link href="/student/certificates">
                <Award className="h-5 w-5 ms-2" />
                {t("viewCertificates")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
