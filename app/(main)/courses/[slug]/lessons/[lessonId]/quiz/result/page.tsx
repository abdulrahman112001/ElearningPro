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
  Hourglass,
  MessageSquareText,
} from "lucide-react"
import { attemptQuestions } from "@/lib/exams"

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

export default async function QuizResultPage({ params, searchParams }: QuizResultPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const t = await getTranslations("quiz")
  const te = await getTranslations("exams")

  if (!searchParams.attemptId) {
    redirect(`/courses/${params.slug}/learn/${params.lessonId}`)
  }

  const attempt = await db.quizAttempt.findUnique({
    where: { id: searchParams.attemptId },
    include: {
      quiz: {
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      },
      answers: true,
    },
  })

  if (!attempt || attempt.userId !== session.user.id || !attempt.completedAt) {
    notFound()
  }

  const quiz = attempt.quiz
  const questions = attemptQuestions(attempt.questionIds, quiz.questions)
  const pending = attempt.needsGrading

  const totalQuestions = questions.length
  const correctAnswers = attempt.answers.filter((a) => a.isCorrect).length
  const wrongAnswers = Math.max(0, totalQuestions - correctAnswers)
  const timeSpentMinutes = attempt.timeSpent ? Math.floor(attempt.timeSpent / 60) : 0
  const timeSpentSeconds = attempt.timeSpent ? attempt.timeSpent % 60 : 0

  const usedAttempts = quiz.maxAttempts
    ? await db.quizAttempt.count({ where: { quizId: quiz.id, userId: session.user.id } })
    : 0
  const canRetake =
    !attempt.passed &&
    !pending &&
    (!quiz.maxAttempts || usedAttempts < quiz.maxAttempts) &&
    (!quiz.availableUntil || quiz.availableUntil > new Date())

  const optionText = (o: any) => o?.textAr || o?.text

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-4xl">
        <Card className="mb-6 overflow-hidden">
          <div
            className={`p-8 text-center text-white ${
              pending
                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                : attempt.passed
                  ? "bg-gradient-to-r from-green-500 to-emerald-600"
                  : "bg-gradient-to-r from-red-500 to-rose-600"
            }`}
          >
            {pending ? (
              <Hourglass className="mx-auto mb-4 h-16 w-16" />
            ) : attempt.passed ? (
              <Trophy className="mx-auto mb-4 h-16 w-16" />
            ) : (
              <XCircle className="mx-auto mb-4 h-16 w-16" />
            )}
            <h1 className="mb-2 text-3xl font-bold">
              {pending ? te("result.awaitingTitle") : attempt.passed ? t("congratulations") : t("tryAgain")}
            </h1>
            <p className="text-lg opacity-90">
              {pending ? te("result.awaitingMessage") : attempt.passed ? t("passedMessage") : t("failedMessage")}
            </p>
          </div>

          <CardContent className="p-6">
            <div className="mb-6 text-center">
              <div className="mb-2 text-5xl font-bold">{Math.round(attempt.score)}%</div>
              <p className="text-muted-foreground">
                {pending ? te("result.provisionalScore") : `${t("passingScore")}: ${quiz.passingScore}%`}
              </p>
            </div>

            <Progress value={attempt.score} className="mb-6 h-3" />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <Target className="mx-auto mb-2 h-6 w-6 text-primary" />
                <div className="text-2xl font-bold">{totalQuestions}</div>
                <div className="text-sm text-muted-foreground">{t("totalQuestions")}</div>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
                <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
                <div className="text-sm text-muted-foreground">{t("correctAnswers")}</div>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
                <XCircle className="mx-auto mb-2 h-6 w-6 text-red-500" />
                <div className="text-2xl font-bold text-red-600">{wrongAnswers}</div>
                <div className="text-sm text-muted-foreground">{t("wrongAnswers")}</div>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <Clock className="mx-auto mb-2 h-6 w-6 text-primary" />
                <div className="text-2xl font-bold">
                  {timeSpentMinutes}:{timeSpentSeconds.toString().padStart(2, "0")}
                </div>
                <div className="text-sm text-muted-foreground">{t("timeSpent")}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {quiz.showResults && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("answersReview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => {
                const answer = attempt.answers.find((a) => a.questionId === question.id)
                const options = (question.options as any[]) ?? []
                const isEssay = question.type === "ESSAY"
                const essayPending = isEssay && !!answer && answer.gradedAt === null
                const selectedIds = Array.isArray(answer?.answer)
                  ? (answer!.answer as string[])
                  : answer?.answer
                    ? [String(answer.answer)]
                    : []
                const selectedText = options
                  .filter((o) => selectedIds.includes(String(o.id)))
                  .map(optionText)
                  .join(" / ")
                const correctText = options.filter((o) => o.isCorrect).map(optionText).join(" / ")
                const tone = essayPending
                  ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                  : answer?.isCorrect
                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                    : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"

                return (
                  <div key={question.id} className={`rounded-lg border p-4 ${tone}`}>
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white ${
                          essayPending ? "bg-amber-500" : answer?.isCorrect ? "bg-green-500" : "bg-red-500"
                        }`}
                      >
                        {essayPending ? (
                          <Hourglass className="h-4 w-4" />
                        ) : answer?.isCorrect ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {question.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={question.imageUrl}
                            alt=""
                            className="mb-2 max-h-48 max-w-full rounded-md border object-contain"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <p className="mb-2 whitespace-pre-line font-medium" dir="auto">
                          {index + 1}. {question.questionAr || question.question}
                        </p>
                        <div className="space-y-1 text-sm">
                          {isEssay ? (
                            <>
                              <p className="font-medium">{t("yourAnswer")}:</p>
                              <p
                                className="whitespace-pre-line rounded-md bg-background/60 p-2 text-muted-foreground"
                                dir="auto"
                              >
                                {answer?.textAnswer || t("notAnswered")}
                              </p>
                              {essayPending && (
                                <p className="text-amber-700 dark:text-amber-400">{te("result.essayPending")}</p>
                              )}
                              {answer?.feedback && (
                                <p className="mt-2 flex items-start gap-1.5">
                                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <span>
                                    <span className="font-medium">{te("result.teacherFeedback")}:</span>{" "}
                                    <span className="whitespace-pre-line">{answer.feedback}</span>
                                  </span>
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-muted-foreground">
                                <span className="font-medium">{t("yourAnswer")}:</span>{" "}
                                {selectedText || t("notAnswered")}
                              </p>
                              {!answer?.isCorrect && (
                                <p className="text-green-600 dark:text-green-400">
                                  <span className="font-medium">{t("correctAnswer")}:</span> {correctText}
                                </p>
                              )}
                            </>
                          )}
                          {question.explanationAr || question.explanation ? (
                            <p className="mt-2 italic text-muted-foreground">
                              <span className="font-medium">{t("explanation")}:</span>{" "}
                              {question.explanationAr || question.explanation}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant={essayPending ? "secondary" : answer?.isCorrect ? "default" : "destructive"}>
                        {essayPending ? "—" : answer?.points ?? 0}/{question.points} {t("points")}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          {canRetake && (
            <Button size="lg" asChild>
              <Link href={`/courses/${params.slug}/lessons/${params.lessonId}/quiz`}>
                <RefreshCw className="me-2 h-5 w-5" />
                {t("retakeQuiz")}
              </Link>
            </Button>
          )}
          <Button variant="outline" size="lg" asChild>
            <Link href={`/courses/${params.slug}/learn`}>
              {t("backToCourse")}
              <ArrowRight className="ms-2 h-5 w-5 rtl:rotate-180" />
            </Link>
          </Button>
          {attempt.passed && (
            <Button variant="secondary" size="lg" asChild>
              <Link href="/student/certificates">
                <Award className="me-2 h-5 w-5" />
                {t("viewCertificates")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
