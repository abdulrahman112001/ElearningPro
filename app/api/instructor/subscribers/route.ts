import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { expireLapsedSubscriptions } from "@/lib/teacher-subscription"

// GET /api/instructor/subscribers: the instructor's subscribers, newest first
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const pending = pendingInstructorResponse(session)
    if (pending) return pending

    await expireLapsedSubscriptions()
    const subscriptions = await db.teacherSubscription.findMany({
      where: { instructorId: session.user.id, status: { in: ["ACTIVE", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            gradeLevel: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
      },
    })

    const now = new Date()
    const revenue = subscriptions.reduce((sum, s) => sum + s.instructorShare, 0)
    const active = subscriptions.filter((s) => s.status === "ACTIVE" && s.endsAt && s.endsAt > now)

    return NextResponse.json({
      subscriptions,
      stats: {
        active: new Set(active.map((s) => s.studentId)).size,
        total: new Set(subscriptions.map((s) => s.studentId)).size,
        revenue: Number(revenue.toFixed(2)),
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get subscribers error:", error)
    return NextResponse.json({ error: "Failed to get subscribers" }, { status: 500 })
  }
}
