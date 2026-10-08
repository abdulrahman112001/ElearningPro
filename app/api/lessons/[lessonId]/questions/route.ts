import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { getCourseAccess } from "@/lib/access"
import { logActivity } from "@/lib/activity"

async function loadLesson(lessonId: string) {
  return db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      chapter: {
        select: {
          course: { select: { id: true, slug: true, titleEn: true, instructorId: true, classGroupId: true } },
        },
      },
    },
  })
}

// GET /api/lessons/:lessonId/questions: discussion under a lesson
export async function GET(request: Request, { params }: { params: { lessonId: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const lesson = await loadLesson(params.lessonId)
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    const access = await getCourseAccess(session.user, lesson.chapter.course)
    if (!access.allowed) return NextResponse.json({ error: "Not enrolled" }, { status: 403 })

    const instructorId = lesson.chapter.course.instructorId
    const questions = await db.question.findMany({
      where: { lessonId: lesson.id },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
        answers: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, image: true, role: true } } },
        },
      },
    })
    return NextResponse.json(
      questions.map((q) => ({
        ...q,
        answeredByInstructor: q.answers.some((a) => a.userId === instructorId),
        answers: q.answers.map((a) => ({ ...a, isInstructor: a.userId === instructorId })),
      }))
    )
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get lesson questions error:", error)
    return NextResponse.json({ error: "Failed to get questions" }, { status: 500 })
  }
}

// POST /api/lessons/:lessonId/questions { content, title? }
export async function POST(request: Request, { params }: { params: { lessonId: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const lesson = await loadLesson(params.lessonId)
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    const course = lesson.chapter.course
    const access = await getCourseAccess(session.user, course)
    if (!access.allowed) return NextResponse.json({ error: "Not enrolled" }, { status: 403 })

    const { content, title } = await readJson(request)
    if (typeof content !== "string" || !content.trim() || content.length > 5000) {
      return NextResponse.json({ error: "Question text is required (max 5000 characters)" }, { status: 400 })
    }
    if (title !== undefined && (typeof title !== "string" || title.length > 200)) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 })
    }
    const text = content.trim()
    const question = await db.question.create({
      data: {
        lessonId: lesson.id,
        userId: session.user.id,
        title: title?.trim() || text.slice(0, 80),
        content: text,
      },
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    })

    if (course.instructorId !== session.user.id) {
      await db.notification.create({
        data: {
          userId: course.instructorId,
          type: "NEW_QUESTION",
          title: "New question on your lesson",
          message: text.slice(0, 140),
          link: `/instructor/questions?lessonId=${lesson.id}`,
        },
      })
    }
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "question.asked",
      entityType: "lesson",
      entityId: lesson.id,
      summary: `Asked on "${lesson.titleEn}": ${text.slice(0, 120)}`,
      metadata: { courseId: course.id, questionId: question.id },
    })
    return NextResponse.json({ ...question, answers: [] }, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create question error:", error)
    return NextResponse.json({ error: "Failed to post question" }, { status: 500 })
  }
}
