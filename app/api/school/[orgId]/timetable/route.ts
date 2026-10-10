import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import {
  findTimetableConflicts,
  requireOrgGroup,
  requireOrgTeacher,
  requireSchoolAccess,
  validateTimetableBody,
} from "@/lib/school"
import { requireUser, run } from "../../_shared"

type Params = { params: { orgId: string } }

const timetableInclude = {
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, image: true } },
} as const

// GET /api/school/:orgId/timetable?groupId=&teacherId=
export async function GET(request: Request, { params }: Params) {
  return run("School timetable", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, false)
    const url = new URL(request.url)
    const groupId = url.searchParams.get("groupId")
    const teacherId = url.searchParams.get("teacherId")
    const entries = await db.timetableEntry.findMany({
      where: {
        organizationId: params.orgId,
        ...(groupId ? { groupId } : {}),
        ...(teacherId ? { teacherId } : {}),
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: timetableInclude,
    })
    return NextResponse.json(entries)
  })
}

// POST /api/school/:orgId/timetable { groupId, subject, teacherId?, dayOfWeek, startTime, endTime, room? }
export async function POST(request: Request, { params }: Params) {
  return run("Add timetable entry", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const body = await readJson(request)
    const group = await requireOrgGroup(params.orgId, body.groupId)
    const fields = validateTimetableBody(body)
    let teacherId: string | null = null
    if (body.teacherId) teacherId = await requireOrgTeacher(params.orgId, body.teacherId)
    else if (body.teacherId === undefined) {
      // Default to the teacher assigned to this subject in the class.
      const cs = await db.classSubject.findUnique({
        where: { groupId_subject: { groupId: group.id, subject: fields.subject } },
        select: { teacherId: true },
      })
      teacherId = cs?.teacherId ?? null
    }
    const conflicts = await findTimetableConflicts({ groupId: group.id, teacherId, ...fields })
    if (conflicts.length) {
      throw new ApiError(409, "This period clashes with another one", { code: "timetable_conflict", conflicts })
    }
    const entry = await db.timetableEntry.create({
      data: { organizationId: params.orgId, groupId: group.id, teacherId, ...fields },
      include: timetableInclude,
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "timetable.created",
      entityType: "timetableEntry",
      entityId: entry.id,
      summary: `Added ${entry.subject} to "${group.name}" timetable (day ${entry.dayOfWeek} ${entry.startTime}-${entry.endTime})`,
      metadata: { organizationId: params.orgId, groupId: group.id },
    })
    return NextResponse.json(entry, { status: 201 })
  })
}
