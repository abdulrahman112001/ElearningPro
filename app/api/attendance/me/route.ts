import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { loadStudentAttendance } from "@/lib/attendance"

// GET /api/attendance/me: the signed-in student's groups, attendance and fees
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json(await loadStudentAttendance(session.user.id))
  } catch (error) {
    console.error("My attendance error:", error)
    return NextResponse.json({ error: "Failed to load attendance" }, { status: 500 })
  }
}
