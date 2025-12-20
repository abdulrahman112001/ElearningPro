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
    const enrollment = await db.enrollment.findUnique({
      where: {
        id: enrollmentId,
        userId: session.user.id,
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
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Upsert progress
    const progress = await db.progress.upsert({
      where: {
        lessonId_enrollmentId: {
          lessonId: params.lessonId,
          enrollmentId,
        },
      },
      update: {
        ...(watchedSeconds !== undefined && { watchedSeconds }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(isCompleted === true && { completedAt: new Date() }),
      },
      create: {
        lessonId: params.lessonId,
        enrollmentId,
        watchedSeconds: watchedSeconds || 0,
        isCompleted: isCompleted || false,
        completedAt: isCompleted ? new Date() : null,
      },
    })

    // Update enrollment progress
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
        enrollmentId,
        isCompleted: true,
      },
    })

    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    await db.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress: progressPercentage,
        status: progressPercentage === 100 ? "COMPLETED" : "ACTIVE",
        completedAt: progressPercentage === 100 ? new Date() : null,
      },
    })

    // Check if course completed and issue certificate
    if (progressPercentage === 100) {
      // Check if certificate already exists
      const existingCertificate = await db.certificate.findFirst({
        where: {
          userId: session.user.id,
          courseId: enrollment.courseId,
        },
      })

      if (!existingCertificate) {
        // Generate certificate
        const certificateNumber = `CERT-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`

        await db.certificate.create({
          data: {
            userId: session.user.id,
            courseId: enrollment.courseId,
            certificateNumber,
            issueDate: new Date(),
          },
        })
      }
    }

    return NextResponse.json({
      progress,
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

    const { searchParams } = new URL(request.url)
    const enrollmentId = searchParams.get("enrollmentId")

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "Enrollment ID is required" },
        { status: 400 }
      )
    }

    const progress = await db.progress.findUnique({
      where: {
        lessonId_enrollmentId: {
          lessonId: params.lessonId,
          enrollmentId,
        },
      },
    })

    return NextResponse.json(
      progress || { watchedSeconds: 0, isCompleted: false }
    )
  } catch (error) {
    console.error("Progress fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    )
  }
}
