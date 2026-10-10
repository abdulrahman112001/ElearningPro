import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { CANCELLED_MODE, LATE_AFTER_MIN } from "@/lib/attendance"

// POST /api/attendance/checkin { token } -> { status, already, group, startsAt }
// Students scan the rotating QR shown by the teacher. Only members of the
// session's group may check in; more than 15 minutes after the start is LATE.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 })
    const limit = rateLimit({ scope: "attendance-checkin", identifier: session.user.id, limit: 20, windowMs: 60_000 })
    if (!limit.success) return tooManyRequests(limit.resetAt)

    const { token } = await readJson(request)
    if (typeof token !== "string" || token.length < 10 || token.length > 100) {
      return NextResponse.json({ error: "Invalid check-in code", code: "invalid_token" }, { status: 400 })
    }
    const gs = await db.groupSession.findUnique({
      where: { qrToken: token },
      select: {
        id: true,
        groupId: true,
        startsAt: true,
        mode: true,
        qrExpiresAt: true,
        group: { select: { name: true } },
      },
    })
    // Rotated tokens disappear, so an unknown token is almost always an old code.
    if (!gs || !gs.qrExpiresAt || gs.qrExpiresAt <= new Date() || gs.mode === CANCELLED_MODE) {
      return NextResponse.json(
        { error: "This check-in code has expired. Scan the code on the screen again.", code: "expired_token" },
        { status: 410 }
      )
    }
    const member = await db.classGroupMember.findUnique({
      where: { groupId_studentId: { groupId: gs.groupId, studentId: session.user.id } },
      select: { id: true },
    })
    if (!member) {
      return NextResponse.json({ error: "You are not a member of this group", code: "not_member" }, { status: 403 })
    }

    const info = { group: gs.group.name, startsAt: gs.startsAt, sessionId: gs.id }
    const existing = await db.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: gs.id, studentId: session.user.id } },
    })
    if (existing && existing.status !== "ABSENT") {
      return NextResponse.json({ status: existing.status, already: true, ...info })
    }
    const status = Date.now() > gs.startsAt.getTime() + LATE_AFTER_MIN * 60000 ? "LATE" : "PRESENT"
    const record = await db.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: gs.id, studentId: session.user.id } },
      create: { sessionId: gs.id, studentId: session.user.id, status, method: "QR" },
      update: { status, method: "QR", markedAt: new Date(), markedById: null },
    })
    return NextResponse.json({ status: record.status, already: false, ...info })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) {
      // Two scans at once: the second one hits the unique constraint.
      if (handled.status === 409) return NextResponse.json({ status: "PRESENT", already: true })
      return handled
    }
    console.error("Check-in error:", error)
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 })
  }
}
