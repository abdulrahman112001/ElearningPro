import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { ensureParentLinkCode, requireStudent } from "@/lib/reports/parent-links"

/** The student's parent link code (created on first request). */
export async function GET() {
  try {
    const guard = await requireStudent()
    if (guard.error) return guard.error
    const code = await ensureParentLinkCode(guard.session.user.id)
    return NextResponse.json({ code })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent code error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/** Issues a new code; the previous one stops working. Existing links stay. */
export async function POST() {
  try {
    const guard = await requireStudent()
    if (guard.error) return guard.error
    const userId = guard.session.user.id
    const limit = rateLimit({ identifier: userId, scope: "parent-code-regenerate", limit: 10, windowMs: 60 * 60_000 })
    if (!limit.success) return tooManyRequests(limit.resetAt)

    const code = await ensureParentLinkCode(userId, true)
    await logActivity({
      actorId: userId,
      actorRole: guard.session.user.role,
      action: "parent.code_regenerated",
      entityType: "user",
      entityId: userId,
      summary: `${guard.session.user.name ?? "Student"} regenerated their parent link code`,
    })
    return NextResponse.json({ code })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent code regenerate error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
