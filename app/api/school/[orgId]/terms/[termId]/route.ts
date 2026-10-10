import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireSchoolAccess } from "@/lib/school"
import { parseTermBody, requireUser, run } from "../../../_shared"

type Params = { params: { orgId: string; termId: string } }

async function findTerm(orgId: string, termId: string) {
  const term = await db.academicTerm.findFirst({ where: { id: termId, organizationId: orgId } })
  if (!term) throw new ApiError(404, "Term not found")
  return term
}

// PATCH /api/school/:orgId/terms/:termId { name?, startsAt?, endsAt?, isCurrent? }
export async function PATCH(request: Request, { params }: Params) {
  return run("Update term", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const term = await findTerm(params.orgId, params.termId)
    const data = parseTermBody(await readJson(request), true)
    const startsAt = data.startsAt ?? term.startsAt
    const endsAt = data.endsAt ?? term.endsAt
    if (endsAt <= startsAt) throw new ApiError(400, "The term must end after it starts", { field: "endsAt", code: "end_before_start" })
    const updated = await db.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.academicTerm.updateMany({
          where: { organizationId: params.orgId, id: { not: term.id } },
          data: { isCurrent: false },
        })
      }
      return tx.academicTerm.update({ where: { id: term.id }, data })
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "term.updated",
      entityType: "academicTerm",
      entityId: term.id,
      summary: `Updated term "${updated.name}"${data.isCurrent ? " (set as current)" : ""}`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json(updated)
  })
}

// DELETE /api/school/:orgId/terms/:termId (grade entries keep their marks, without a term)
export async function DELETE(_request: Request, { params }: Params) {
  return run("Delete term", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const term = await findTerm(params.orgId, params.termId)
    await db.academicTerm.delete({ where: { id: term.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "term.deleted",
      entityType: "academicTerm",
      entityId: term.id,
      summary: `Deleted term "${term.name}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json({ ok: true })
  })
}
