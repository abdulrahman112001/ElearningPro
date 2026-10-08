import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createRoom, generateToken } from "@/lib/livekit"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// Create live class
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await readJson(request)
    const {
      courseId,
      title,
      titleAr,
      description,
      descriptionAr,
      scheduledAt,
      duration, // in minutes
    } = body

    if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) {
      return NextResponse.json({ error: "Invalid scheduled time" }, { status: 400 })
    }

    if (!title || !scheduledAt) {
      return NextResponse.json(
        { error: "Title and scheduled time are required" },
        { status: 400 }
      )
    }

    // Verify course ownership if courseId provided
    if (courseId) {
      const course = await db.course.findUnique({
        where: {
          id: courseId,
          instructorId: session.user.id,
        },
      })

      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 })
      }
    }

    // Create live class record
    const liveClass = await db.liveClass.create({
      data: {
        title,
        titleAr,
        description,
        descriptionAr,
        scheduledAt: new Date(scheduledAt),
        duration: duration || 60,
        status: "SCHEDULED",
        instructorId: session.user.id,
        courseId,
        roomName: `live_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      },
    })

    return NextResponse.json(liveClass, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create live class error:", error)
    return NextResponse.json(
      { error: "Failed to create live class" },
      { status: 500 }
    )
  }
}

// Get instructor's live classes
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const courseId = searchParams.get("courseId")

    const where: any = {}

    if (session.user.role === "INSTRUCTOR") {
      where.instructorId = session.user.id
    } else if (session.user.role !== "ADMIN") {
      // Students only see classes of courses they are enrolled in, plus
      // public classes that are not attached to any course.
      const enrollments = await db.enrollment.findMany({
        where: { userId: session.user.id },
        select: { courseId: true },
      })
      where.OR = [
        { courseId: { in: enrollments.map((e) => e.courseId) } },
        { courseId: null },
      ]
    }

    if (status) {
      if (!["SCHEDULED", "LIVE", "ENDED", "CANCELLED"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      where.status = status
    }

    if (courseId) {
      where.courseId = courseId
    }

    const liveClasses = await db.liveClass.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        course: {
          select: {
            id: true,
            titleEn: true,
            titleAr: true,
            slug: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
    })

    return NextResponse.json(liveClasses)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get live classes error:", error)
    return NextResponse.json(
      { error: "Failed to get live classes" },
      { status: 500 }
    )
  }
}
