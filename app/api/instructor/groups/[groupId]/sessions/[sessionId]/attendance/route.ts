import { NextResponse } from "next/server"
import type { AttendanceStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import {
  ATTENDANCE_STATUSES,
  CANCELLED_MODE,
  cairoDateKey,
  findGroupSession,
  requireGroupManager,
} from "@/lib/attendance"

type Params = { params: { groupId: string; sessionId: string } }

const isStatus = (s: unknown): s is AttendanceStatus =>
  typeof s === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(s)

// PUT /api/instructor/groups/:id/sessions/:sessionId/attendance
// { records: [{ studentId, status }] } or { all: "PRESENT" } (every member)
export async function PUT(request: Request, { params }: Params) {
  try {
    const { session: auth, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await findGroupSession(params.groupId, params.sessionId)
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    if (session.mode === CANCELLED_MODE) {
      return NextResponse.json({ error: "The session is cancelled", code: "cancelled" }, { status: 409 })
    }

    const body = await readJson(request)
    const memberIds = new Set(
      (await db.classGroupMember.findMany({ where: { groupId: params.groupId }, select: { studentId: true } })).map(
        (m) => m.studentId
      )
    )
    let changes: { studentId: string; status: AttendanceStatus }[]
    if (body.all !== undefined) {
      if (!isStatus(body.all)) return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      changes = Array.from(memberIds, (studentId) => ({ studentId, status: body.all }))
    } else {
      if (!Array.isArray(body.records) || body.records.length === 0 || body.records.length > 500) {
        return NextResponse.json({ error: "records must be a non-empty list" }, { status: 400 })
      }
      changes = []
      for (const r of body.records) {
        if (!r || typeof r.studentId !== "string" || !isStatus(r.status)) {
          return NextResponse.json({ error: "Each record needs studentId and a valid status" }, { status: 400 })
        }
        if (!memberIds.has(r.studentId)) {
          return NextResponse.json({ error: "Student is not a member of this group", code: "not_member" }, { status: 400 })
        }
        changes.push({ studentId: r.studentId, status: r.status })
      }
    }

    await db.$transaction(
      changes.map((c) =>
        db.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: c.studentId } },
          create: {
            sessionId: session.id,
            studentId: c.studentId,
            status: c.status,
            method: "MANUAL",
            markedById: auth.user.id,
          },
          update: { status: c.status, method: "MANUAL", markedById: auth.user.id, markedAt: new Date() },
        })
      )
    )

    const tally: Record<string, number> = {}
    for (const c of changes) tally[c.status] = (tally[c.status] ?? 0) + 1
    if (changes.length > 0) {
      await logActivity({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "attendance.marked",
        entityType: "groupSession",
        entityId: session.id,
        summary: `Marked attendance of ${changes.length} students for ${cairoDateKey(session.startsAt)}`,
        metadata: { groupId: params.groupId, ...tally },
      })
    }
    return NextResponse.json({ updated: changes.length, tally })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Mark attendance error:", error)
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 })
  }
}
