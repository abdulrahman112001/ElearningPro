import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { getCourseAccess } from "@/lib/access"
import { logActivity } from "@/lib/activity"

// POST /api/questions/:questionId/answers { content }
export async function POST(request: Request, { params }: { params: { questionId: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const question = await db.question.findUnique({
      where: { id: params.questionId },
      select: {
        id: true,
        userId: true,
        lessonId: true,
        lesson: {
          select: {
            titleEn: true,
            chapter: {
              select: { course: { select: { id: true, slug: true, instructorId: true, classGroupId: true } } },
            },
          },
        },
      },
    })
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 })
    const course = question.lesson.chapter.course
    const access = await getCourseAccess(session.user, course)
    if (!access.allowed) return NextResponse.json({ error: "Not enrolled" }, { status: 403 })

    const { content } = await readJson(request)
    if (typeof content !== "string" || !content.trim() || content.length > 5000) {
      return NextResponse.json({ error: "Answer text is required (max 5000 characters)" }, { status: 400 })
    }

    const answer = await db.answer.create({
      data: { questionId: question.id, userId: session.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    })

    if (question.userId !== session.user.id) {
      await db.notification.create({
        data: {
          userId: question.userId,
          type: "QUESTION_ANSWERED",
          title: course.instructorId === session.user.id ? "Your teacher answered your question" : "New reply to your question",
          message: content.trim().slice(0, 140),
          link: `/courses/${course.slug}/learn/${question.lessonId}`,
        },
      })
    }
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "question.answered",
      entityType: "question",
      entityId: question.id,
      summary: `Answered on "${question.lesson.titleEn}": ${content.trim().slice(0, 120)}`,
      metadata: { courseId: course.id },
    })
    return NextResponse.json({ ...answer, isInstructor: course.instructorId === session.user.id }, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create answer error:", error)
    return NextResponse.json({ error: "Failed to post answer" }, { status: 500 })
  }
}
