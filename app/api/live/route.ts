import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createRoom, generateToken } from "@/lib/livekit"

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

    const body = await request.json()
    const {
      courseId,
      title,
      titleAr,
      description,
      descriptionAr,
      scheduledAt,
      duration, // in minutes
    } = body

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
    }

    if (status) {
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
            title: true,
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
    console.error("Get live classes error:", error)
    return NextResponse.json(
      { error: "Failed to get live classes" },
      { status: 500 }
    )
  }
}
