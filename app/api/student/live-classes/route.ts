import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's enrolled courses
    const enrollments = await db.enrollment.findMany({
      where: { userId: session.user.id },
      select: { courseId: true },
    })

    const enrolledCourseIds = enrollments.map((e) => e.courseId)

    // Get live classes for enrolled courses or public classes
    const liveClasses = await db.liveClass.findMany({
      where: {
        OR: [
          // Classes for enrolled courses
          { courseId: { in: enrolledCourseIds } },
          // Public classes (no course attached)
          { courseId: null },
        ],
      },
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
            titleAr: true,
            titleEn: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
      orderBy: [
        { status: "asc" }, // LIVE first, then SCHEDULED, then ENDED
        { scheduledAt: "asc" },
      ],
    })

    return NextResponse.json(liveClasses)
  } catch (error) {
    console.error("[STUDENT_LIVE_CLASSES_GET]", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
