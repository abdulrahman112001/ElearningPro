import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { MAX_TRANSCRIPT } from "@/lib/ai/validate"

/**
 * PATCH /api/instructor/lessons/[lessonId]/transcript { transcript }
 * Lesson text the AI tutor and question generator use. Course owner or admin.
 * An empty string clears it.
 */
export async function PATCH(request: Request, { params }: { params: { lessonId: string } }) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error

    const { transcript } = await readJson(request)
    if (typeof transcript !== "string") {
      return NextResponse.json({ error: "transcript must be a string", code: "validation" }, { status: 400 })
    }
    if (transcript.length > MAX_TRANSCRIPT) {
      return NextResponse.json(
        { error: `Transcript is too long (max ${MAX_TRANSCRIPT} characters)`, code: "too_long", max: MAX_TRANSCRIPT },
        { status: 400 }
      )
    }

    const lesson = await db.lesson.findUnique({
      where: { id: params.lessonId },
      select: { id: true, chapter: { select: { course: { select: { id: true, instructorId: true } } } } },
    })
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    if (session.user.role !== "ADMIN" && lesson.chapter.course.instructorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const value = transcript.trim() ? transcript.replace(/\r\n/g, "\n") : null
    await db.lesson.update({ where: { id: lesson.id }, data: { transcript: value } })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "lesson.transcript_updated",
      entityType: "Lesson",
      entityId: lesson.id,
      summary: value ? `Lesson transcript updated (${value.length} characters)` : "Lesson transcript cleared",
      metadata: { courseId: lesson.chapter.course.id, length: value?.length ?? 0 },
    })

    return NextResponse.json({ transcript: value, length: value?.length ?? 0 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update transcript error:", error)
    return NextResponse.json({ error: "Failed to save the transcript" }, { status: 500 })
  }
}
