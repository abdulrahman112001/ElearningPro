import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { findTimetableConflicts, requireOrgTeacher, requireSchoolAccess, validateTimetableBody } from "@/lib/school"
import { requireUser, run } from "../../../_shared"

type Params = { params: { orgId: string; id: string } }

const timetableInclude = {
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, image: true } },
} as const

async function findEntry(orgId: string, id: string) {
  const entry = await db.timetableEntry.findFirst({ where: { id, organizationId: orgId } })
  if (!entry) throw new ApiError(404, "Timetable entry not found")
  return entry
}

// PATCH /api/school/:orgId/timetable/:id { subject?, teacherId?, dayOfWeek?, startTime?, endTime?, room? }
export async function PATCH(request: Request, { params }: Params) {
  return run("Update timetable entry", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const entry = await findEntry(params.orgId, params.id)
    const body = await readJson(request)
    const fields = validateTimetableBody({
      subject: body.subject ?? entry.subject,
      dayOfWeek: body.dayOfWeek ?? entry.dayOfWeek,
      startTime: body.startTime ?? entry.startTime,
      endTime: body.endTime ?? entry.endTime,
      room: body.room === undefined ? entry.room : body.room,
    })
    let teacherId = entry.teacherId
    if (body.teacherId !== undefined) {
      teacherId = body.teacherId ? await requireOrgTeacher(params.orgId, body.teacherId) : null
    }
    const conflicts = await findTimetableConflicts({ groupId: entry.groupId, teacherId, ...fields }, entry.id)
    if (conflicts.length) {
      throw new ApiError(409, "This period clashes with another one", { code: "timetable_conflict", conflicts })
    }
    const updated = await db.timetableEntry.update({
      where: { id: entry.id },
      data: { ...fields, teacherId },
      include: timetableInclude,
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "timetable.updated",
      entityType: "timetableEntry",
      entityId: entry.id,
      summary: `Updated ${updated.subject} in "${updated.group.name}" timetable`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json(updated)
  })
}

// DELETE /api/school/:orgId/timetable/:id
export async function DELETE(_request: Request, { params }: Params) {
  return run("Delete timetable entry", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const entry = await findEntry(params.orgId, params.id)
    await db.timetableEntry.delete({ where: { id: entry.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "timetable.deleted",
      entityType: "timetableEntry",
      entityId: entry.id,
      summary: `Removed ${entry.subject} (day ${entry.dayOfWeek} ${entry.startTime}) from the timetable`,
      metadata: { organizationId: params.orgId, groupId: entry.groupId },
    })
    return NextResponse.json({ ok: true })
  })
}
