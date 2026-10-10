import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrgTeacher, requireSchoolAccess } from "@/lib/school"
import { requireUser, run } from "../../../_shared"

type Params = { params: { orgId: string; id: string } }

async function findSubject(orgId: string, id: string) {
  const row = await db.classSubject.findFirst({
    where: { id, group: { organizationId: orgId } },
    include: { group: { select: { name: true } } },
  })
  if (!row) throw new ApiError(404, "Subject not found")
  return row
}

// PATCH /api/school/:orgId/subjects/:id { teacherId }
export async function PATCH(request: Request, { params }: Params) {
  return run("Update class subject", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const row = await findSubject(params.orgId, params.id)
    const body = await readJson(request)
    const teacherId = await requireOrgTeacher(params.orgId, body.teacherId)
    const updated = await db.classSubject.update({
      where: { id: row.id },
      data: { teacherId },
      include: { teacher: { select: { id: true, name: true, image: true } } },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "subject.assigned",
      entityType: "classSubject",
      entityId: row.id,
      summary: `${updated.teacher.name ?? "Teacher"} now teaches ${row.subject} in "${row.group.name}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json(updated)
  })
}

// DELETE /api/school/:orgId/subjects/:id
export async function DELETE(_request: Request, { params }: Params) {
  return run("Remove class subject", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const row = await findSubject(params.orgId, params.id)
    await db.classSubject.delete({ where: { id: row.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "subject.removed",
      entityType: "classSubject",
      entityId: row.id,
      summary: `Removed ${row.subject} from "${row.group.name}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json({ ok: true })
  })
}
