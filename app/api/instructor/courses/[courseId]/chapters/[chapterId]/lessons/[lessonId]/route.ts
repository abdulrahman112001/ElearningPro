import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Update lesson
export async function PATCH(
  request: Request,
  {
    params,
  }: { params: { courseId: string; chapterId: string; lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const lesson = await db.lesson.findFirst({
      where: {
        id: params.lessonId,
        chapterId: params.chapterId,
        chapter: {
          courseId: params.courseId,
          course: {
            instructorId: session.user.id,
          },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const body = await request.json()
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
      isPublished,
    } = body

    const updatedLesson = await db.lesson.update({
      where: { id: params.lessonId },
      data: {
        titleEn: title,
        titleAr,
        descriptionEn: description,
        descriptionAr,
        videoUrl,
        videoProvider,
        videoDuration: duration,
        isFree,
        isPublished,
      },
    })

    return NextResponse.json(updatedLesson)
  } catch (error) {
    console.error("Update lesson error:", error)
    return NextResponse.json(
      { error: "Failed to update lesson" },
      { status: 500 }
    )
  }
}

// Delete lesson
export async function DELETE(
  request: Request,
  {
    params,
  }: { params: { courseId: string; chapterId: string; lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const lesson = await db.lesson.findFirst({
      where: {
        id: params.lessonId,
        chapterId: params.chapterId,
        chapter: {
          courseId: params.courseId,
          course: {
            instructorId: session.user.id,
          },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Delete lesson
    await db.lesson.delete({
      where: { id: params.lessonId },
    })

    // Reorder remaining lessons
    const remainingLessons = await db.lesson.findMany({
      where: { chapterId: params.chapterId },
      orderBy: { position: "asc" },
    })

    await db.$transaction(
      remainingLessons.map((l, index) =>
        db.lesson.update({
          where: { id: l.id },
          data: { position: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete lesson error:", error)
    return NextResponse.json(
      { error: "Failed to delete lesson" },
      { status: 500 }
    )
  }
}
