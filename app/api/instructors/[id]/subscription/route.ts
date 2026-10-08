import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { getActiveTeacherSubscription } from "@/lib/access"

// GET /api/instructors/:id/subscription: public offer plus the viewer's own status
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const instructor = await db.user.findFirst({
      where: { id: params.id, role: "INSTRUCTOR" },
      select: {
        id: true,
        name: true,
        instructorProfile: { select: { subscriptionEnabled: true, monthlyPrice: true } },
        _count: { select: { courses: { where: { status: "PUBLISHED" } } } },
      },
    })
    if (!instructor) return NextResponse.json({ error: "Instructor not found" }, { status: 404 })

    const session = await auth()
    const active = session?.user ? await getActiveTeacherSubscription(session.user.id, instructor.id) : null

    return NextResponse.json({
      instructorId: instructor.id,
      enabled: instructor.instructorProfile?.subscriptionEnabled ?? false,
      monthlyPrice: instructor.instructorProfile?.monthlyPrice ?? 0,
      publishedCourses: instructor._count.courses,
      subscribed: !!active,
      endsAt: active?.endsAt ?? null,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get instructor subscription error:", error)
    return NextResponse.json({ error: "Failed to get subscription" }, { status: 500 })
  }
}
