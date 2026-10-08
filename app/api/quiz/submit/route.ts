import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import {
  computeCertificateGrade,
  generateCertificateNumber,
  hasPassedAllQuizzes,
} from "@/lib/certificates"

interface AnswerInput {
  questionId: string
  answer: string | string[]
}

export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { success, resetAt } = rateLimit({
      identifier: session.user.id,
      scope: "quiz-submit",
      limit: 20,
      windowMs: 60_000,
    })
    if (!success) {
      return tooManyRequests(resetAt)
    }

    const { attemptId, answers } = (await readJson(req)) as {
      attemptId: string
      answers: AnswerInput[]
    }

    if (
      typeof attemptId !== "string" ||
      !attemptId ||
      !Array.isArray(answers) ||
      !answers.every((a) => a && typeof a.questionId === "string")
    ) {
      return NextResponse.json(
        { error: "Attempt ID and an answers array are required" },
        { status: 400 }
      )
    }

    // Get attempt
    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
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
        },
      },
    })

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    if (attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (attempt.completedAt) {
      return NextResponse.json(
        { error: "This attempt has already been submitted" },
        { status: 400 }
      )
    }

    // Enforce the time limit on the server; the client timer alone can be
    // bypassed. A short grace period covers network latency on auto-submit.
    if (attempt.quiz.timeLimit) {
      const elapsedSeconds = (Date.now() - attempt.startedAt.getTime()) / 1000
      const GRACE_SECONDS = 60
      if (elapsedSeconds > attempt.quiz.timeLimit * 60 + GRACE_SECONDS) {
        await db.quizAttempt.update({
          where: { id: attempt.id },
          data: {
            completedAt: new Date(),
            score: 0,
            passed: false,
            timeSpent: Math.floor(elapsedSeconds),
          },
        })
        return NextResponse.json(
          { error: "Time limit exceeded", errorAr: "انتهى الوقت المحدد للاختبار" },
          { status: 400 }
        )
      }
    }

    // Calculate score
    let totalPoints = 0
    let earnedPoints = 0
    const quizAnswers: {
      questionId: string
      answer: any
      isCorrect: boolean
      points: number
    }[] = []

    for (const question of attempt.quiz.questions) {
      totalPoints += question.points
      const userAnswer = answers.find((a) => a.questionId === question.id)
      const options = question.options as any[]

      if (!userAnswer) {
        quizAnswers.push({
          questionId: question.id,
          answer: null,
          isCorrect: false,
          points: 0,
        })
        continue
      }

      let isCorrect = false

      if (question.type === "MULTIPLE_SELECT") {
        // Multiple select: all correct options must be selected
        const correctOptionIds = options
          .filter((o) => o.isCorrect)
          .map((o) => o.id)
          .sort()
        const selectedIds = (
          Array.isArray(userAnswer.answer)
            ? userAnswer.answer
            : [userAnswer.answer]
        ).sort()

        isCorrect =
          correctOptionIds.length === selectedIds.length &&
          correctOptionIds.every((id, index) => id === selectedIds[index])
      } else {
        // Single choice or true/false
        const selectedOptionId = Array.isArray(userAnswer.answer)
          ? userAnswer.answer[0]
          : userAnswer.answer
        const selectedOption = options.find((o) => o.id === selectedOptionId)
        isCorrect = selectedOption?.isCorrect === true
      }

      const points = isCorrect ? question.points : 0
      earnedPoints += points

      quizAnswers.push({
        questionId: question.id,
        answer: userAnswer.answer,
        isCorrect,
        points,
      })
    }

    const scorePercentage =
      totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    const passed = scorePercentage >= attempt.quiz.passingScore

    // Calculate time spent
    const timeSpent = Math.floor(
      (new Date().getTime() - attempt.startedAt.getTime()) / 1000
    )

    // Update attempt and create answers
    await db.$transaction([
      db.quizAttempt.update({
        where: { id: attemptId },
        data: {
          score: scorePercentage,
          passed,
          completedAt: new Date(),
          timeSpent,
        },
      }),
      ...quizAnswers.map((answer) =>
        db.quizAnswer.create({
          data: {
            attemptId,
            questionId: answer.questionId,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            points: answer.points,
          },
        })
      ),
    ])

    // Mark lesson as completed if passed
    if (passed) {
      await db.progress.upsert({
        where: {
          userId_lessonId: {
            userId: session.user.id,
            lessonId: attempt.quiz.lessonId,
          },
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          lessonId: attempt.quiz.lessonId,
          isCompleted: true,
          completedAt: new Date(),
        },
      })

      // Update enrollment progress
      const course = attempt.quiz.lesson.chapter.course
      const allLessons = await db.lesson.findMany({
        where: {
          chapter: {
            courseId: course.id,
          },
          isPublished: true,
        },
        select: { id: true },
      })

      const completedLessons = await db.progress.count({
        where: {
          userId: session.user.id,
          lessonId: { in: allLessons.map((l) => l.id) },
          isCompleted: true,
        },
      })

      const progressPercentage = (completedLessons / allLessons.length) * 100

      await db.enrollment.update({
        where: {
          userId_courseId: {
            userId: session.user.id,
            courseId: course.id,
          },
        },
        data: {
          progress: progressPercentage,
          isCompleted: progressPercentage >= 100,
          completedAt: progressPercentage >= 100 ? new Date() : null,
        },
      })

      // Generate certificate if course completed
      if (
        progressPercentage >= 100 &&
        (await hasPassedAllQuizzes(session.user.id, course.id))
      ) {
        const existingCertificate = await db.certificate.findUnique({
          where: {
            userId_courseId: {
              userId: session.user.id,
              courseId: course.id,
            },
          },
        })

        if (!existingCertificate) {
          const certificateNo = generateCertificateNumber()

          await db.certificate.create({
            data: {
              certificateNo,
              userId: session.user.id,
              courseId: course.id,
              completedAt: new Date(),
              grade: await computeCertificateGrade(session.user.id, course.id),
            },
          })
        }
      }
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "quiz.submitted",
      entityType: "quiz",
      entityId: attempt.quizId,
      summary: `Scored ${Math.round(scorePercentage)}% (${passed ? "passed" : "failed"}) on "${attempt.quiz.title}"`,
      metadata: { attemptId, score: scorePercentage, passed },
    })

    return NextResponse.json({
      attemptId,
      score: scorePercentage,
      passed,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("[QUIZ_SUBMIT]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
