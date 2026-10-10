import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCourseAccess } from "@/lib/access"
import { QuizClient } from "@/components/quiz/quiz-client"
import { attemptDeadline, attemptQuestions, sanitizeQuestion } from "@/lib/exams"

interface QuizPageProps {
  params: {
    slug: string
    lessonId: string
  }
}

export async function generateMetadata({ params }: QuizPageProps) {
  const t = await getTranslations("quiz")

  const lesson = await db.lesson.findUnique({
    where: { id: params.lessonId },
    select: { titleAr: true, titleEn: true },
  })

  return {
    title: lesson
      ? `${t("quiz")} - ${lesson.titleAr || lesson.titleEn}`
      : t("quiz"),
  }
}

export default async function QuizPage({ params }: QuizPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const course = await db.course.findUnique({
    where: { slug: params.slug },
    select: { id: true, titleEn: true, titleAr: true, instructorId: true, classGroupId: true },
  })

  if (!course) {
    notFound()
  }

  const access = await getCourseAccess(session.user, course)
  if (!access.allowed) {
    redirect(`/courses/${params.slug}`)
  }

  const lesson = await db.lesson.findFirst({
    where: { id: params.lessonId, chapter: { courseId: course.id } },
    include: {
      quiz: {
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      },
    },
  })

  if (!lesson || !lesson.quiz) {
    notFound()
  }
  const quiz = lesson.quiz

  const existingAttempt = await db.quizAttempt.findFirst({
    where: { quizId: quiz.id, userId: session.user.id, completedAt: null },
    orderBy: { startedAt: "desc" },
  })

  const [attemptsCount, attemptsUsed] = await Promise.all([
    db.quizAttempt.count({
      where: { quizId: quiz.id, userId: session.user.id, completedAt: { not: null } },
    }),
    db.quizAttempt.count({ where: { quizId: quiz.id, userId: session.user.id } }),
  ])

  // Only the questions of an attempt in progress are sent, never the answer key.
  const resume = existingAttempt
    ? {
        attemptId: existingAttempt.id,
        deadline: attemptDeadline(existingAttempt.startedAt, quiz)?.toISOString() ?? null,
        tabSwitches: existingAttempt.tabSwitches,
        questions: attemptQuestions(existingAttempt.questionIds, quiz.questions).map(sanitizeQuestion),
      }
    : undefined

  const total = quiz.questions.length
  const quizData = {
    id: quiz.id,
    title: quiz.title,
    titleAr: quiz.titleAr,
    description: quiz.description,
    passingScore: quiz.passingScore,
    timeLimit: quiz.timeLimit,
    questionCount:
      quiz.questionsPerAttempt && quiz.questionsPerAttempt < total ? quiz.questionsPerAttempt : total,
    availableFrom: quiz.availableFrom?.toISOString() ?? null,
    availableUntil: quiz.availableUntil?.toISOString() ?? null,
    maxAttempts: quiz.maxAttempts,
    detectTabSwitch: quiz.detectTabSwitch,
    hasEssay: quiz.questions.some((q) => q.type === "ESSAY"),
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <QuizClient
        quiz={quizData}
        lessonId={params.lessonId}
        courseSlug={params.slug}
        resume={resume}
        attemptsCount={attemptsCount}
        attemptsUsed={attemptsUsed}
      />
    </div>
  )
}
