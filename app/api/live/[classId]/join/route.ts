import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-error"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCourseAccess } from "@/lib/access"
import { generateToken } from "@/lib/livekit"

// Join live class (students)
export async function POST(
  request: Request,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const liveClass = await db.liveClass.findUnique({
      where: { id: params.classId },
      include: {
        course: true,
      },
    })

    if (!liveClass) {
      return NextResponse.json(
        { error: "Live class not found" },
        { status: 404 }
      )
    }

    if (liveClass.status !== "LIVE") {
      return NextResponse.json(
        { error: "Class is not live yet" },
        { status: 400 }
      )
    }

    // Check if user is enrolled in the course (if course-specific)
    if (liveClass.courseId) {
      const liveCourse = await db.course.findUnique({
        where: { id: liveClass.courseId },
        select: { id: true, instructorId: true, classGroupId: true },
      })
      // Enrolled, subscribed to the teacher, host or admin
      const access = liveCourse
        ? await getCourseAccess(session.user, liveCourse)
        : { allowed: false as const }
      const isInstructor = liveClass.instructorId === session.user.id

      if (!access.allowed && !isInstructor) {
        return NextResponse.json(
          { error: "You must be enrolled in this course" },
          { status: 403 }
        )
      }
    }

    // Record attendance
    await db.liveClassAttendee.upsert({
      where: {
        liveClassId_userId: {
          liveClassId: params.classId,
          userId: session.user.id,
        },
      },
      update: {
        lastSeenAt: new Date(),
      },
      create: {
        liveClassId: params.classId,
        userId: session.user.id,
        joinedAt: new Date(),
      },
    })

    // Generate token for student (not host)
    const isHost = liveClass.instructorId === session.user.id
    const token = await generateToken(
      liveClass.roomName,
      session.user.name || "Student",
      session.user.id,
      isHost
    )

    return NextResponse.json({
      token,
      roomName: liveClass.roomName,
      wsUrl: process.env.LIVEKIT_URL,
      isHost,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Join live class error:", error)
    return NextResponse.json(
      { error: "Failed to join live class" },
      { status: 500 }
    )
  }
}
