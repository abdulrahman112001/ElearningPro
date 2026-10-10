import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

/**
 * POST /api/quiz/attempts/[attemptId]/tab-switch
 * Records that the student left the exam tab/window. Owner only, and only
 * while the attempt is in progress on a quiz with tab-switch detection on.
 */
export async function POST(_req: Request, { params }: { params: { attemptId: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success, resetAt } = rateLimit({
      identifier: session.user.id,
      scope: "quiz-tab-switch",
      limit: 60,
      windowMs: 60_000,
    })
    if (!success) return tooManyRequests(resetAt)

    const attempt = await db.quizAttempt.findUnique({
      where: { id: params.attemptId },
      select: { id: true, userId: true, completedAt: true, quiz: { select: { detectTabSwitch: true } } },
    })
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    if (attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (attempt.completedAt) {
      return NextResponse.json({ error: "Attempt already submitted", code: "attempt_completed" }, { status: 409 })
    }
    if (!attempt.quiz.detectTabSwitch) {
      return NextResponse.json({ error: "Tab-switch detection is off for this exam", code: "detection_disabled" }, { status: 400 })
    }

    // Conditional update so a switch racing with submission is not counted after it.
    const updated = await db.quizAttempt.updateMany({
      where: { id: attempt.id, completedAt: null },
      data: { tabSwitches: { increment: 1 } },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: "Attempt already submitted", code: "attempt_completed" }, { status: 409 })
    }
    const { tabSwitches } = await db.quizAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      select: { tabSwitches: true },
    })
    return NextResponse.json({ tabSwitches })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("[QUIZ_TAB_SWITCH]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
