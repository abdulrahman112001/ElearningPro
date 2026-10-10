import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireSchoolAccess } from "@/lib/school"
import { requireUser, run } from "../../../_shared"

type Params = { params: { orgId: string; id: string } }

async function findAnnouncement(orgId: string, id: string) {
  const row = await db.announcement.findFirst({ where: { id, organizationId: orgId } })
  if (!row) throw new ApiError(404, "Announcement not found")
  return row
}

// PATCH /api/school/:orgId/announcements/:id { pinned } (managers)
export async function PATCH(request: Request, { params }: Params) {
  return run("Update announcement", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, true)
    const row = await findAnnouncement(params.orgId, params.id)
    const body = await readJson(request)
    if (typeof body.pinned !== "boolean") throw new ApiError(400, "pinned must be true or false", { field: "pinned" })
    const updated = await db.announcement.update({ where: { id: row.id }, data: { pinned: body.pinned } })
    return NextResponse.json(updated)
  })
}

// DELETE /api/school/:orgId/announcements/:id (author or managers)
export async function DELETE(_request: Request, { params }: Params) {
  return run("Delete announcement", async () => {
    const session = await requireUser()
    const { canManage } = await requireSchoolAccess(params.orgId, session.user, false)
    const row = await findAnnouncement(params.orgId, params.id)
    if (!canManage && row.authorId !== session.user.id) throw new ApiError(403, "You cannot delete this announcement")
    await db.announcement.delete({ where: { id: row.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "announcement.deleted",
      entityType: "announcement",
      entityId: row.id,
      summary: `Deleted announcement "${row.title}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json({ ok: true })
  })
}
