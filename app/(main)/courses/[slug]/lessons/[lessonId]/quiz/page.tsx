import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { QuizClient } from "@/components/quiz/quiz-client"

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

  const t = await getTranslations("quiz")

  // Get course and lesson
  const course = await db.course.findUnique({
    where: { slug: params.slug },
    select: { id: true, titleEn: true, titleAr: true },
  })

  if (!course) {
    notFound()
  }

  // Check enrollment
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: course.id,
      },
    },
  })

  if (!enrollment) {
    redirect(`/courses/${params.slug}`)
  }

  // Get lesson with quiz
  const lesson = await db.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  })

  if (!lesson || !lesson.quiz) {
    notFound()
  }

  // Check for existing incomplete attempt
  const existingAttempt = await db.quizAttempt.findFirst({
    where: {
      quizId: lesson.quiz.id,
      userId: session.user.id,
      completedAt: null,
    },
    orderBy: { startedAt: "desc" },
  })

  // Get previous attempts count
  const attemptsCount = await db.quizAttempt.count({
    where: {
      quizId: lesson.quiz.id,
      userId: session.user.id,
      completedAt: { not: null },
    },
  })

  // Prepare quiz data (remove correct answers for client)
  const quizData = {
    id: lesson.quiz.id,
    title: lesson.quiz.title,
    titleAr: lesson.quiz.titleAr,
    description: lesson.quiz.description,
    passingScore: lesson.quiz.passingScore,
    timeLimit: lesson.quiz.timeLimit,
    shuffleQuestions: lesson.quiz.shuffleQuestions,
    questions: lesson.quiz.questions.map((q) => ({
      id: q.id,
      question: q.question,
      questionAr: q.questionAr,
      type: q.type,
      points: q.points,
      options: (q.options as any[]).map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        textAr: opt.textAr,
      })),
    })),
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <QuizClient
        quiz={quizData}
        lessonId={params.lessonId}
        courseSlug={params.slug}
        existingAttemptId={existingAttempt?.id}
        attemptsCount={attemptsCount}
      />
    </div>
  )
}
