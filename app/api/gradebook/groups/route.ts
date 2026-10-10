import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { listManageableGroups } from "@/lib/school"

// GET /api/gradebook/groups : groups whose gradebook the teacher can open
export async function GET() {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const groups = await listManageableGroups(session.user)
    return NextResponse.json(
      groups.map((g) => ({ id: g.id, name: g.name, organization: g.organization, members: g._count.members }))
    )
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Gradebook groups error:", error)
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 })
  }
}
