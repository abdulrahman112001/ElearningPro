import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity"
import { runWeeklyReports } from "@/lib/reports/weekly-report"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Weekly parent reports, called by Vercel Cron (Friday 16:00 UTC) with
 * `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  const header = request.headers.get("authorization") ?? ""
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runWeeklyReports()
    await logActivity({
      action: "parent.weekly_reports_sent",
      entityType: "system",
      summary: `Weekly reports: ${result.sent + result.logged} sent, ${result.failed} failed, ${result.skipped} skipped`,
      metadata: { sent: result.sent, logged: result.logged, failed: result.failed, skipped: result.skipped, students: result.students, trigger: "cron" },
    })
    return NextResponse.json({ ...result, deliveries: undefined })
  } catch (error) {
    console.error("Weekly reports cron error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
