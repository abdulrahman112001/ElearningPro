import { NextResponse } from "next/server"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { generateSessions, requireGroupManager } from "@/lib/attendance"

// POST /api/instructor/groups/:id/schedule/generate { weeks } -> { created, skipped }
export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const { weeks = 4 } = await readJson(request)
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 26) {
      return NextResponse.json({ error: "weeks must be between 1 and 26" }, { status: 400 })
    }
    const result = await generateSessions(params.groupId, weeks)
    if (result.created > 0) {
      await logActivity({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "attendance.sessions_generated",
        entityType: "classGroup",
        entityId: params.groupId,
        summary: `Generated ${result.created} sessions for ${weeks} weeks`,
        metadata: { weeks, ...result },
      })
    }
    return NextResponse.json(result)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Generate sessions error:", error)
    return NextResponse.json({ error: "Failed to generate sessions" }, { status: 500 })
  }
}
