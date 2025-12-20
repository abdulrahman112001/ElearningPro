import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Submit quiz attempt
export async function POST(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const quiz = await db.quiz.findUnique({
      where: { lessonId: params.lessonId },
      include: {
        questions: true,
        lesson: {
          include: {
            chapter: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    })

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Check enrollment
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: quiz.lesson.chapter.course.id,
        },
      },
    })

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
    }

    const body = await request.json()
    const { answers, startedAt, timeSpent } = body

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Answers are required" },
        { status: 400 }
      )
    }

    // Calculate score
    let totalPoints = 0
    let earnedPoints = 0
    const answerResults: any[] = []

    for (const question of quiz.questions) {
      const userAnswer = answers[question.id]
      const options = question.options as any[]

      totalPoints += question.points

      let isCorrect = false

      if (
        question.type === "MULTIPLE_CHOICE" ||
        question.type === "TRUE_FALSE"
      ) {
        // Single answer
        const correctOption = options.find((opt) => opt.isCorrect)
        isCorrect = userAnswer === correctOption?.id
      } else if (question.type === "MULTIPLE_SELECT") {
        // Multiple answers
        const correctOptionIds = options
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id)
        const userAnswerArray = Array.isArray(userAnswer) ? userAnswer : []

        isCorrect =
          correctOptionIds.length === userAnswerArray.length &&
          correctOptionIds.every((id) => userAnswerArray.includes(id))
      }

      const pointsEarned = isCorrect ? question.points : 0
      earnedPoints += pointsEarned

      answerResults.push({
        questionId: question.id,
        answer: userAnswer,
        isCorrect,
        points: pointsEarned,
      })
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    const passed = score >= quiz.passingScore

    // Create attempt
    const attempt = await db.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: session.user.id,
        score,
        passed,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        completedAt: new Date(),
        timeSpent: timeSpent || 0,
        answers: {
          create: answerResults.map((ar) => ({
            questionId: ar.questionId,
            answer: ar.answer,
            isCorrect: ar.isCorrect,
            points: ar.points,
          })),
        },
      },
      include: {
        answers: true,
      },
    })

    // If passed, mark lesson as complete
    if (passed) {
      await db.progress.upsert({
        where: {
          userId_lessonId: {
            userId: session.user.id,
            lessonId: params.lessonId,
          },
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          lessonId: params.lessonId,
          isCompleted: true,
          completedAt: new Date(),
        },
      })
    }

    // Prepare response
    const response: any = {
      attemptId: attempt.id,
      score,
      passed,
      passingScore: quiz.passingScore,
      totalQuestions: quiz.questions.length,
      correctAnswers: answerResults.filter((a) => a.isCorrect).length,
    }

    // Include detailed results if showResults is enabled
    if (quiz.showResults) {
      response.results = quiz.questions.map((q) => {
        const result = answerResults.find((ar) => ar.questionId === q.id)
        return {
          questionId: q.id,
          question: q.question,
          questionAr: q.questionAr,
          userAnswer: result?.answer,
          isCorrect: result?.isCorrect,
          correctAnswer: (q.options as any[])
            .filter((opt) => opt.isCorrect)
            .map((opt) => opt.id),
          explanation: q.explanation,
          explanationAr: q.explanationAr,
        }
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Submit quiz error:", error)
    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    )
  }
}

// Get user's attempts for a quiz
export async function GET(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const quiz = await db.quiz.findUnique({
      where: { lessonId: params.lessonId },
    })

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const attempts = await db.quizAttempt.findMany({
      where: {
        quizId: quiz.id,
        userId: session.user.id,
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        score: true,
        passed: true,
        startedAt: true,
        completedAt: true,
        timeSpent: true,
      },
    })

    return NextResponse.json({
      attempts,
      bestScore:
        attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : 0,
      hasPassed: attempts.some((a) => a.passed),
    })
  } catch (error) {
    console.error("Get attempts error:", error)
    return NextResponse.json(
      { error: "Failed to get attempts" },
      { status: 500 }
    )
  }
}
