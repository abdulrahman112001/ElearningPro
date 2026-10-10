import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { cleanText, requireOrgGroup, requireOrgTeacher, requireSchoolAccess } from "@/lib/school"
import { requireUser, run } from "../../_shared"

type Params = { params: { orgId: string } }

// POST /api/school/:orgId/subjects { groupId, subject, teacherId }
export async function POST(request: Request, { params }: Params) {
  return run("Add class subject", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const body = await readJson(request)
    const group = await requireOrgGroup(params.orgId, body.groupId)
    const subject = cleanText(body.subject, 80)
    if (!subject) throw new ApiError(400, "Subject is required", { field: "subject", code: "required" })
    const teacherId = await requireOrgTeacher(params.orgId, body.teacherId)
    const exists = await db.classSubject.findUnique({ where: { groupId_subject: { groupId: group.id, subject } } })
    if (exists) throw new ApiError(409, "This class already has this subject", { code: "duplicate_subject" })
    const row = await db.classSubject.create({
      data: { groupId: group.id, subject, teacherId },
      include: { teacher: { select: { id: true, name: true, image: true } } },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "subject.assigned",
      entityType: "classSubject",
      entityId: row.id,
      summary: `Assigned ${row.teacher.name ?? "teacher"} to teach ${subject} in "${group.name}"`,
      metadata: { organizationId: params.orgId, groupId: group.id },
    })
    return NextResponse.json(row, { status: 201 })
  })
}
