import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import {
  CANCELLED_MODE,
  cairoDateKey,
  cairoTime,
  findGroupSession,
  notifyAbsentees,
  requireGroupManager,
} from "@/lib/attendance"

type Params = { params: { groupId: string; sessionId: string } }

// POST .../close: stops check-in, marks every member without a record ABSENT
// and notifies newly absent students and their parents (once per record).
export async function POST(request: Request, { params }: Params) {
  try {
    const { session: auth, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await findGroupSession(params.groupId, params.sessionId)
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    if (session.mode === CANCELLED_MODE) {
      return NextResponse.json({ error: "The session is cancelled", code: "cancelled" }, { status: 409 })
    }

    await db.groupSession.update({ where: { id: session.id }, data: { qrToken: null, qrExpiresAt: null } })
    const [members, marked] = await Promise.all([
      db.classGroupMember.findMany({ where: { groupId: params.groupId }, select: { studentId: true } }),
      db.attendanceRecord.findMany({ where: { sessionId: session.id }, select: { studentId: true } }),
    ])
    const markedIds = new Set(marked.map((m) => m.studentId))
    const missing = members.filter((m) => !markedIds.has(m.studentId))
    const { count: absent } = await db.attendanceRecord.createMany({
      data: missing.map((m) => ({
        sessionId: session.id,
        studentId: m.studentId,
        status: "ABSENT" as const,
        method: "MANUAL",
        markedById: auth.user.id,
      })),
      skipDuplicates: true,
    })
    const notified = await notifyAbsentees(session.id)

    const tallyRows = await db.attendanceRecord.groupBy({
      by: ["status"],
      where: { sessionId: session.id },
      _count: { _all: true },
    })
    const tally = Object.fromEntries(tallyRows.map((r) => [r.status, r._count._all]))
    await logActivity({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "attendance.session_closed",
      entityType: "groupSession",
      entityId: session.id,
      summary: `Closed the session of ${cairoDateKey(session.startsAt)} ${cairoTime(session.startsAt)}: ${absent} marked absent`,
      metadata: { groupId: params.groupId, markedAbsent: absent, notified, ...tally },
    })
    return NextResponse.json({ markedAbsent: absent, notified, tally })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Close session error:", error)
    return NextResponse.json({ error: "Failed to close the session" }, { status: 500 })
  }
}
