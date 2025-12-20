import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { lessonId, watchedDuration, completed } = body

    if (!lessonId) {
      return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
    }

    // Get lesson and course info
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          select: {
            courseId: true,
          },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const courseId = lesson.chapter.courseId

    // Check enrollment
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Not enrolled in this course" },
        { status: 403 }
      )
    }

    // Update or create lesson progress
    const progress = await db.progress.upsert({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
      update: {
        watchedTime: watchedDuration || 0,
        isCompleted: completed || false,
      },
      create: {
        userId: session.user.id,
        lessonId,
        watchedTime: watchedDuration || 0,
        isCompleted: completed || false,
      },
    })

    // Update course progress
    await updateCourseProgress(session.user.id, courseId)

    return NextResponse.json({ success: true, progress })
  } catch (error) {
    console.error("Progress update error:", error)
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    )
  }
}

async function updateCourseProgress(userId: string, courseId: string) {
  // Get all lessons in course
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        where: { isPublished: true },
        include: {
          lessons: {
            where: { isPublished: true },
          },
        },
      },
    },
  })

  if (!course) return

  const allLessonIds = course.chapters.flatMap((ch) =>
    ch.lessons.map((l) => l.id)
  )
  const totalLessons = allLessonIds.length

  if (totalLessons === 0) return

  // Count completed lessons
  const completedCount = await db.progress.count({
    where: {
      userId,
      lessonId: { in: allLessonIds },
      isCompleted: true,
    },
  })

  const progressPercentage = Math.round((completedCount / totalLessons) * 100)

  // Update enrollment progress
  await db.enrollment.update({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    data: {
      progress: progressPercentage,
    },
  })
}
