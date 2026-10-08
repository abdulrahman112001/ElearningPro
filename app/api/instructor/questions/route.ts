import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"

// GET /api/instructor/questions?status=unanswered|all&lessonId=
// Student questions on the instructor's lessons (the Q&A inbox).
export async function GET(request: Request) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") ?? "all"
    const lessonId = searchParams.get("lessonId")
    const instructorId = session.user.id

    const questions = await db.question.findMany({
      where: {
        lesson: { chapter: { course: { instructorId } } },
        ...(lessonId && { lessonId }),
        ...(status === "unanswered" && { answers: { none: { userId: instructorId } } }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, image: true } },
        lesson: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            chapter: { select: { course: { select: { id: true, titleAr: true, titleEn: true, slug: true } } } },
          },
        },
        answers: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, image: true, role: true } } },
        },
      },
    })
    const unanswered = await db.question.count({
      where: {
        lesson: { chapter: { course: { instructorId } } },
        answers: { none: { userId: instructorId } },
      },
    })
    return NextResponse.json({
      questions: questions.map((q) => ({ ...q, answeredByInstructor: q.answers.some((a) => a.userId === instructorId) })),
      unanswered,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get instructor questions error:", error)
    return NextResponse.json({ error: "Failed to get questions" }, { status: 500 })
  }
}
