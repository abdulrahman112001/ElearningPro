import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// Get lessons
export async function GET(
  request: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const chapter = await db.chapter.findFirst({
      where: {
        id: params.chapterId,
        courseId: params.courseId,
        course: {
          instructorId: session.user.id,
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    const lessons = await db.lesson.findMany({
      where: { chapterId: params.chapterId },
      orderBy: { position: "asc" },
    })

    return NextResponse.json(lessons)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get lessons error:", error)
    return NextResponse.json(
      { error: "Failed to get lessons" },
      { status: 500 }
    )
  }
}

// Create lesson
export async function POST(
  request: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const chapter = await db.chapter.findFirst({
      where: {
        id: params.chapterId,
        courseId: params.courseId,
        course: {
          instructorId: session.user.id,
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    const body = await readJson(request)
    const {
      title,
      titleAr,
      description,
      descriptionAr,
      type,
      videoUrl,
      videoProvider,
      content,
      contentAr,
      duration,
      isFree,
      position,
    } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Get next position if not provided
    let lessonPosition = position
    if (lessonPosition === undefined) {
      const lastLesson = await db.lesson.findFirst({
        where: { chapterId: params.chapterId },
        orderBy: { position: "desc" },
      })
      lessonPosition = (lastLesson?.position ?? -1) + 1
    }

    const lesson = await db.lesson.create({
      data: {
        titleEn: title,
        titleAr: titleAr || title,
        descriptionEn: description,
        descriptionAr,
        videoUrl,
        videoProvider,
        videoDuration: duration || 0,
        isFree: isFree || false,
        position: lessonPosition,
        chapterId: params.chapterId,
      },
    })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "lesson.created",
      entityType: "lesson",
      entityId: lesson.id,
      summary: `Added lesson "${lesson.titleEn}"`,
      metadata: { courseId: params.courseId },
    })

    return NextResponse.json(lesson, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create lesson error:", error)
    return NextResponse.json(
      { error: "Failed to create lesson" },
      { status: 500 }
    )
  }
}

// Reorder lessons
export async function PUT(
  request: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const chapter = await db.chapter.findFirst({
      where: {
        id: params.chapterId,
        courseId: params.courseId,
        course: {
          instructorId: session.user.id,
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    const body = await readJson(request)
    const { lessons } = body // Array of { id, position }

    if (
      !Array.isArray(lessons) ||
      !lessons.every((l: any) => typeof l?.id === "string" && Number.isInteger(l?.position))
    ) {
      return NextResponse.json({ error: "lessons must be an array of { id, position }" }, { status: 400 })
    }

    // Scope every update to this chapter so foreign lesson ids match nothing.
    const results = await db.$transaction(
      lessons.map((l: { id: string; position: number }) =>
        db.lesson.updateMany({
          where: { id: l.id, chapterId: chapter.id },
          data: { position: l.position },
        })
      )
    )
    if (results.some((r) => r.count !== 1)) {
      return NextResponse.json({ error: "Lesson not found in this chapter" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Reorder lessons error:", error)
    return NextResponse.json(
      { error: "Failed to reorder lessons" },
      { status: 500 }
    )
  }
}
