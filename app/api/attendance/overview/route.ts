import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { loadTeacherOverview } from "@/lib/attendance"

// GET /api/attendance/overview: today's sessions and outstanding fees across
// every group the user manages (own groups + organizations they manage).
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const pending = pendingInstructorResponse(session)
    if (pending) return pending
    return NextResponse.json(await loadTeacherOverview(session.user))
  } catch (error) {
    console.error("Attendance overview error:", error)
    return NextResponse.json({ error: "Failed to load the overview" }, { status: 500 })
  }
}
