import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { readJson, apiErrorResponse, ApiError } from "@/lib/api-error"
import { onLessonCompleted, onQuizSubmitted } from "@/lib/gamification"
import {
  SUBMIT_GRACE_SECONDS,
  attemptDeadline,
  attemptQuestions,
  attemptResultLink,
  gradeObjective,
  onQuizPassed,
} from "@/lib/exams"

interface AnswerInput {
  questionId: string
  answer: unknown
}

const MAX_ESSAY_LENGTH = 20_000

/** Stored form of an objective answer: an option id or a list of them ("" = unanswered). */
function normalizeAnswer(raw: unknown): string | string[] {
  if (typeof raw === "string") return raw.slice(0, 200)
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string").slice(0, 50).map((x) => x.slice(0, 200))
  }
  return ""
}

/**
 * Submits an attempt. Only the questions served in the attempt may be
 * answered. Objective questions are graded immediately; essay answers are
 * stored for the teacher and the attempt stays "not passed" (needsGrading)
 * until graded.
 *
 * Time limit: answers arriving later than the deadline (startedAt + time limit,
 * or the exam closing time, whichever is first) plus a 60s grace period are
 * REJECTED (400, code time_limit_exceeded): the attempt is closed with score 0,
 * because the server cannot tell which answers were given in time.
 */
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
      answers.length > 1000 ||
      !answers.every((a) => a && typeof a.questionId === "string")
    ) {
      return NextResponse.json(
        { error: "Attempt ID and an answers array are required" },
        { status: 400 }
      )
    }

    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: true,
            lesson: { include: { chapter: { include: { course: true } } } },
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
        { error: "This attempt has already been submitted", code: "already_submitted" },
        { status: 400 }
      )
    }

    const quiz = attempt.quiz
    const course = quiz.lesson.chapter.course
    const served = attemptQuestions(attempt.questionIds, quiz.questions)
    const servedIds = new Set(served.map((q) => q.id))

    // Only the questions of this attempt may be answered.
    const foreign = answers.find((a) => !servedIds.has(a.questionId))
    if (foreign) {
      return NextResponse.json(
        { error: "Answer for a question that is not part of this attempt", code: "question_not_in_attempt", questionId: foreign.questionId },
        { status: 400 }
      )
    }

    // Server-side deadline; the client timer alone can be bypassed.
    const now = new Date()
    const elapsedSeconds = Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000)
    const deadline = attemptDeadline(attempt.startedAt, quiz)
    if (deadline && now.getTime() > deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000) {
      await db.quizAttempt.updateMany({
        where: { id: attempt.id, completedAt: null },
        data: { completedAt: now, score: 0, passed: false, needsGrading: false, timeSpent: elapsedSeconds },
      })
      return NextResponse.json(
        { error: "Time limit exceeded", errorAr: "انتهى الوقت المحدد للاختبار", code: "time_limit_exceeded" },
        { status: 400 }
      )
    }

    let totalPoints = 0
    let earnedPoints = 0
    let needsGrading = false
    const rows: {
      questionId: string
      answer: string | string[]
      isCorrect: boolean
      points: number
      textAnswer: string | null
      gradedAt: Date | null
      manualScore: number | null
    }[] = []

    for (const question of served) {
      totalPoints += question.points
      const userAnswer = answers.find((a) => a.questionId === question.id)

      if (question.type === "ESSAY") {
        const raw = userAnswer?.answer
        const text = (typeof raw === "string" ? raw : "").trim().slice(0, MAX_ESSAY_LENGTH)
        if (text) needsGrading = true
        rows.push({
          questionId: question.id,
          answer: "",
          isCorrect: false,
          points: 0,
          textAnswer: text || null,
          // A blank essay is worth 0 and needs no teacher.
          gradedAt: text ? null : now,
          manualScore: text ? null : 0,
        })
        continue
      }

      const isCorrect = userAnswer ? gradeObjective(question, userAnswer.answer) : false
      const points = isCorrect ? question.points : 0
      earnedPoints += points
      rows.push({
        questionId: question.id,
        answer: normalizeAnswer(userAnswer?.answer),
        isCorrect,
        points,
        textAnswer: null,
        gradedAt: null,
        manualScore: null,
      })
    }

    const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    const passed = !needsGrading && scorePercentage >= quiz.passingScore

    await db.$transaction(async (tx) => {
      // Guards against a concurrent double submit.
      const closed = await tx.quizAttempt.updateMany({
        where: { id: attemptId, completedAt: null },
        data: {
          score: scorePercentage,
          passed,
          needsGrading,
          completedAt: now,
          timeSpent: elapsedSeconds,
        },
      })
      if (closed.count === 0) {
        throw new ApiError(400, "This attempt has already been submitted", { code: "already_submitted" })
      }
      await tx.quizAnswer.createMany({
        data: rows.map((r) => ({ ...r, attemptId })),
      })
    })

    if (passed) {
      await onQuizPassed(session.user.id, quiz.lessonId, course.id)
    }

    if (needsGrading) {
      await db.notification.create({
        data: {
          userId: course.instructorId,
          type: "SYSTEM",
          title: "إجابة مقالية تنتظر التصحيح",
          message: `${session.user.name ?? "طالب"} سلّم "${quiz.titleAr || quiz.title}" وبه أسئلة مقالية تحتاج تصحيحك.`,
          link: `/instructor/grading?attempt=${attemptId}`,
        },
      })
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "quiz.submitted",
      entityType: "quiz",
      entityId: attempt.quizId,
      summary: needsGrading
        ? `Submitted "${quiz.title}" (awaiting essay grading, provisional ${Math.round(scorePercentage)}%)`
        : `Scored ${Math.round(scorePercentage)}% (${passed ? "passed" : "failed"}) on "${quiz.title}"`,
      metadata: { attemptId, score: scorePercentage, passed, needsGrading, tabSwitches: attempt.tabSwitches },
    })

    // Points / badges (idempotent, never throws). Essays award once graded.
    let gamification = null
    if (!needsGrading) {
      gamification = await onQuizSubmitted(session.user.id, attemptId, scorePercentage, passed)
      if (passed) await onLessonCompleted(session.user.id, quiz.lessonId)
    }

    return NextResponse.json({
      attemptId,
      score: scorePercentage,
      passed,
      needsGrading,
      gamification,
      resultUrl: attemptResultLink(course.slug, quiz.lessonId, attemptId),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("[QUIZ_SUBMIT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
