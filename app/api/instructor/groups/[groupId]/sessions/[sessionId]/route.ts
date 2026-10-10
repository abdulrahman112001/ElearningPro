import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import {
  CANCELLED_MODE,
  cairoDateKey,
  cairoTime,
  findGroupSession,
  parseSessionBody,
  requireGroupManager,
} from "@/lib/attendance"

type Params = { params: { groupId: string; sessionId: string } }

const studentSelect = { id: true, name: true, email: true, image: true } as const

// GET /api/instructor/groups/:id/sessions/:sessionId: session + roster with statuses
export async function GET(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await db.groupSession.findFirst({
      where: { id: params.sessionId, groupId: params.groupId },
      include: { group: { select: { id: true, name: true, mode: true, location: true } } },
    })
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    const [members, records] = await Promise.all([
      db.classGroupMember.findMany({
        where: { groupId: params.groupId },
        select: { student: { select: studentSelect } },
      }),
      db.attendanceRecord.findMany({
        where: { sessionId: session.id },
        include: { student: { select: studentSelect } },
      }),
    ])
    const byStudent = new Map(records.map((r) => [r.studentId, r]))
    const roster = members.map((m) => {
      const r = byStudent.get(m.student.id)
      byStudent.delete(m.student.id)
      return {
        student: m.student,
        member: true,
        status: r?.status ?? null,
        method: r?.method ?? null,
        markedAt: r?.markedAt ?? null,
      }
    })
    // Students who left the group after being marked stay visible.
    byStudent.forEach((r) => {
      roster.push({ student: r.student, member: false, status: r.status, method: r.method, markedAt: r.markedAt })
    })
    roster.sort((a, b) => (a.student.name ?? "").localeCompare(b.student.name ?? ""))
    const { qrToken, ...rest } = session
    void qrToken
    return NextResponse.json({
      session: {
        ...rest,
        cancelled: session.mode === CANCELLED_MODE,
        date: cairoDateKey(session.startsAt),
        time: cairoTime(session.startsAt),
        checkinActive: !!session.qrExpiresAt && session.qrExpiresAt > new Date(),
      },
      roster,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get session error:", error)
    return NextResponse.json({ error: "Failed to load the session" }, { status: 500 })
  }
}

// PATCH /api/instructor/groups/:id/sessions/:sessionId
// { date?, time?, durationMin?, title?, mode?, location?, notes? } (mode also restores a cancelled session)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await findGroupSession(params.groupId, params.sessionId)
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    const parsed = parseSessionBody(await readJson(request), true)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const d = parsed.data
    const startsAt = d.startsAt ?? session.startsAt
    if (d.startsAt && d.startsAt.getTime() !== session.startsAt.getTime()) {
      const clash = await db.groupSession.findFirst({
        where: { groupId: params.groupId, startsAt: d.startsAt, id: { not: session.id } },
        select: { id: true },
      })
      if (clash) {
        return NextResponse.json({ error: "A session already exists at this time", code: "duplicate_session" }, { status: 409 })
      }
    }
    const oldDuration = session.endsAt
      ? Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60000)
      : 60
    const duration = d.durationMin ?? oldDuration
    const updated = await db.groupSession.update({
      where: { id: session.id },
      data: {
        startsAt,
        endsAt: new Date(startsAt.getTime() + duration * 60000),
        ...(d.title !== undefined && { title: d.title }),
        ...(d.mode !== undefined && { mode: d.mode }),
        ...(d.location !== undefined && { location: d.location }),
        ...(d.notes !== undefined && { notes: d.notes }),
      },
    })
    return NextResponse.json({ ...updated, qrToken: undefined })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update session error:", error)
    return NextResponse.json({ error: "Failed to update the session" }, { status: 500 })
  }
}

// DELETE /api/instructor/groups/:id/sessions/:sessionId: cancels the session.
// The row is kept (mode CANCELLED) so schedule generation does not recreate it.
// ?purge=1 deletes it for good when nobody was marked yet.
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { session: auth, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await findGroupSession(params.groupId, params.sessionId)
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    const purge = new URL(request.url).searchParams.get("purge") === "1"
    if (purge) {
      const marked = await db.attendanceRecord.count({ where: { sessionId: session.id } })
      if (marked > 0) {
        return NextResponse.json({ error: "Attendance was already taken", code: "has_attendance" }, { status: 409 })
      }
      await db.groupSession.delete({ where: { id: session.id } })
    } else {
      await db.groupSession.update({
        where: { id: session.id },
        data: { mode: CANCELLED_MODE, qrToken: null, qrExpiresAt: null },
      })
    }
    await logActivity({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "attendance.session_cancelled",
      entityType: "groupSession",
      entityId: session.id,
      summary: `Cancelled the session of ${cairoDateKey(session.startsAt)} ${cairoTime(session.startsAt)}`,
      metadata: { groupId: params.groupId, purge },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Cancel session error:", error)
    return NextResponse.json({ error: "Failed to cancel the session" }, { status: 500 })
  }
}
