import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = params

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
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
    }

    // Get all lessons in course
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          where: { isPublished: true },
          include: {
            lessons: {
              where: { isPublished: true },
              select: { id: true },
            },
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const allLessonIds = course.chapters.flatMap((ch) =>
      ch.lessons.map((l) => l.id)
    )

    // Get lesson progress
    const lessonProgress = await db.progress.findMany({
      where: {
        userId: session.user.id,
        lessonId: { in: allLessonIds },
      },
      select: {
        lessonId: true,
        isCompleted: true,
        watchedTime: true,
      },
    })

    // Create progress map
    const progressMap: Record<string, boolean> = {}
    lessonProgress.forEach((p) => {
      progressMap[p.lessonId] = p.isCompleted
    })

    return NextResponse.json({
      courseProgress: enrollment.progress,
      lessonProgress: progressMap,
      totalLessons: allLessonIds.length,
      completedLessons: lessonProgress.filter((p) => p.isCompleted).length,
    })
  } catch (error) {
    console.error("Get progress error:", error)
    return NextResponse.json(
      { error: "Failed to get progress" },
      { status: 500 }
    )
  }
}
