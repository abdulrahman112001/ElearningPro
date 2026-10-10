import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { MAX_GRANT, allowedViews, getSecuritySettings } from "@/lib/video-protection"

/** Gives a student extra views on one of the teacher's lessons. */
export async function POST(request: Request) {
  try {
    const guard = await requireInstructor()
    if (guard.error) return guard.error
    const { session } = guard

    const body = await readJson(request)
    const { lessonId, studentId, extra } = body ?? {}
    if (typeof lessonId !== "string" || !lessonId || typeof studentId !== "string" || !studentId) {
      return NextResponse.json({ error: "lessonId and studentId are required" }, { status: 400 })
    }
    if (typeof extra !== "number" || !Number.isInteger(extra) || extra < 1 || extra > MAX_GRANT) {
      return NextResponse.json(
        { error: `extra must be an integer between 1 and ${MAX_GRANT}`, code: "invalid_extra" },
        { status: 400 }
      )
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        titleEn: true,
        titleAr: true,
        maxViews: true,
        chapter: { select: { course: { select: { id: true, slug: true, instructorId: true, titleEn: true } } } },
      },
    })
    const course = lesson?.chapter.course
    if (!lesson || !course || (course.instructorId !== session.user.id && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const student = await db.user.findUnique({ where: { id: studentId }, select: { id: true, name: true } })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const view = await db.lessonView.upsert({
      where: { lessonId_userId: { lessonId, userId: studentId } },
      update: { extraViews: { increment: extra } },
      create: { lessonId, userId: studentId, count: 0, extraViews: extra },
    })
    const settings = await getSecuritySettings()
    const viewsAllowed = allowedViews(lesson.maxViews, settings.defaultMaxViews, view.extraViews)

    await db.notification.create({
      data: {
        userId: studentId,
        type: "SYSTEM",
        title: "تمت إضافة مشاهدات جديدة",
        message: `أضاف المعلم ${extra} مشاهدة إضافية لدرس "${lesson.titleAr || lesson.titleEn}"`,
        link: `/courses/${course.slug}/learn/${lesson.id}`,
      },
    })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "video.views_granted",
      entityType: "lesson",
      entityId: lesson.id,
      summary: `Granted ${extra} extra view(s) on "${lesson.titleEn}" to ${student.name ?? studentId}`,
      metadata: { lessonId, studentId, extra, courseId: course.id, totalExtra: view.extraViews },
    })

    return NextResponse.json({
      lessonId,
      studentId,
      extraViews: view.extraViews,
      viewsUsed: view.count,
      viewsAllowed,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Grant views error:", error)
    return NextResponse.json({ error: "Failed to grant views" }, { status: 500 })
  }
}
