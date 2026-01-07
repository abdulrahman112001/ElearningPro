import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { enrollmentId, watchedSeconds, isCompleted } = await request.json()

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "Enrollment ID is required" },
        { status: 400 }
      )
    }

    // Verify enrollment belongs to user
    const enrollment = await db.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId: session.user.id,
      },
      select: {
        id: true,
        userId: true,
        courseId: true,
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      )
    }

    // Verify lesson exists and belongs to enrolled course
    const lesson = await db.lesson.findFirst({
      where: {
        id: params.lessonId,
        chapter: {
          courseId: enrollment.courseId,
        },
      },
      select: {
        id: true,
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const progress = await db.progress.upsert({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId: params.lessonId,
        },
      },
      update: {
        ...(watchedSeconds !== undefined && { watchedTime: watchedSeconds }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(isCompleted === true && { completedAt: new Date() }),
      },
      create: {
        userId: session.user.id,
        lessonId: params.lessonId,
        watchedTime: watchedSeconds || 0,
        isCompleted: isCompleted || false,
        completedAt: isCompleted ? new Date() : null,
      },
    })

    // Update enrollment progress based on published lessons
    const totalLessons = await db.lesson.count({
      where: {
        chapter: {
          courseId: enrollment.courseId,
          isPublished: true,
        },
        isPublished: true,
      },
    })

    const completedLessons = await db.progress.count({
      where: {
        userId: session.user.id,
        isCompleted: true,
        lesson: {
          chapter: {
            courseId: enrollment.courseId,
            isPublished: true,
          },
          isPublished: true,
        },
      },
    })

    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    await db.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress: progressPercentage,
        isCompleted: progressPercentage === 100,
        completedAt: progressPercentage === 100 ? new Date() : null,
      },
    })

    return NextResponse.json({
      watchedSeconds: progress.watchedTime,
      isCompleted: progress.isCompleted,
      overallProgress: progressPercentage,
    })
  } catch (error) {
    console.error("Progress update error:", error)
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const progress = await db.progress.findUnique({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId: params.lessonId,
        },
      },
      select: {
        watchedTime: true,
        isCompleted: true,
      },
    })

    return NextResponse.json({
      watchedSeconds: progress?.watchedTime || 0,
      isCompleted: progress?.isCompleted || false,
    })
  } catch (error) {
    console.error("Progress fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    )
  }
}
