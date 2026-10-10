import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/instructor-guard"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { runWeeklyReports } from "@/lib/reports/weekly-report"

export const maxDuration = 300

/** Sends the weekly reports now (optionally for one student: {studentId}). */
export async function POST(request: Request) {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error
    const body = await readJson(request)
    if (body.studentId !== undefined && typeof body.studentId !== "string") {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 })
    }
    const result = await runWeeklyReports({ studentId: body.studentId || undefined })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "parent.weekly_reports_sent",
      entityType: "system",
      summary: `Weekly reports sent manually: ${result.sent + result.logged} sent, ${result.failed} failed, ${result.skipped} skipped`,
      metadata: {
        sent: result.sent,
        logged: result.logged,
        failed: result.failed,
        skipped: result.skipped,
        students: result.students,
        trigger: "admin",
        ...(body.studentId ? { studentId: body.studentId } : {}),
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin weekly reports error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
