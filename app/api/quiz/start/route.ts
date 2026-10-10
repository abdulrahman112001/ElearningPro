import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCourseAccess } from "@/lib/access"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { attemptDeadline, attemptQuestions, sanitizeQuestion, shuffle } from "@/lib/exams"

/**
 * Starts (or resumes) an attempt. Enforces the exam window and the attempt
 * limit, picks the questions served in this attempt (a random subset when the
 * quiz is configured so) and returns them without the answer key.
 *
 * 403 codes: exam_not_open (+ opensAt), exam_closed, max_attempts_reached.
 */
export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { success, resetAt } = rateLimit({
      identifier: session.user.id,
      scope: "quiz-start",
      limit: 20,
      windowMs: 60_000,
    })
    if (!success) {
      return tooManyRequests(resetAt)
    }

    const { quizId } = await readJson(req)

    if (!quizId || typeof quizId !== "string") {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { position: "asc" } },
        lesson: { include: { chapter: { include: { course: true } } } },
      },
    })

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const access = await getCourseAccess(session.user, quiz.lesson.chapter.course)
    if (!access.allowed) {
      return NextResponse.json(
        { error: "You must be enrolled to take this quiz" },
        { status: 403 }
      )
    }

    const respond = (attempt: { id: string; attemptNumber: number; startedAt: Date; questionIds: string[] }) => {
      const deadline = attemptDeadline(attempt.startedAt, quiz)
      return NextResponse.json({
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt.toISOString(),
        deadline: deadline?.toISOString() ?? null,
        detectTabSwitch: quiz.detectTabSwitch,
        questions: attemptQuestions(attempt.questionIds, quiz.questions).map(sanitizeQuestion),
      })
    }

    // An attempt already in progress is resumed as-is (its own questions and clock).
    const existingAttempt = await db.quizAttempt.findFirst({
      where: { quizId, userId: session.user.id, completedAt: null },
      orderBy: { startedAt: "desc" },
    })
    if (existingAttempt) return respond(existingAttempt)

    const now = new Date()
    if (quiz.availableFrom && now < quiz.availableFrom) {
      return NextResponse.json(
        { error: "This exam is not open yet", code: "exam_not_open", opensAt: quiz.availableFrom.toISOString() },
        { status: 403 }
      )
    }
    if (quiz.availableUntil && now > quiz.availableUntil) {
      return NextResponse.json(
        { error: "This exam is closed", code: "exam_closed", closedAt: quiz.availableUntil.toISOString() },
        { status: 403 }
      )
    }

    const previousAttempts = await db.quizAttempt.count({
      where: { quizId, userId: session.user.id },
    })
    if (quiz.maxAttempts && previousAttempts >= quiz.maxAttempts) {
      return NextResponse.json(
        { error: "You have used all your attempts", code: "max_attempts_reached", maxAttempts: quiz.maxAttempts },
        { status: 403 }
      )
    }

    if (quiz.questions.length === 0) {
      return NextResponse.json({ error: "This quiz has no questions", code: "no_questions" }, { status: 400 })
    }

    // Pick the questions for this attempt.
    let picked = quiz.questions
    if (quiz.questionsPerAttempt && quiz.questionsPerAttempt < picked.length) {
      picked = shuffle(picked).slice(0, quiz.questionsPerAttempt)
      if (!quiz.shuffleQuestions) picked.sort((a, b) => a.position - b.position)
    } else if (quiz.shuffleQuestions) {
      picked = shuffle(picked)
    }

    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: session.user.id,
        score: 0,
        passed: false,
        attemptNumber: previousAttempts + 1,
        questionIds: picked.map((q) => q.id),
      },
    })

    return respond(attempt)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("[QUIZ_START]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
