import { NextResponse } from "next/server"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrg, serverError } from "../../../_lib"
import { loadOrgClass, parseClassInput } from "../_validate"

type Params = { params: { orgId: string; groupId: string } }

// GET /api/organizations/[orgId]/classes/[groupId]: class with its students
export async function GET(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ["OWNER", "MANAGER", "TEACHER"])
    if (guard.error) return guard.error
    const group = await db.classGroup.findFirst({
      where: { id: params.groupId, organizationId: params.orgId },
      include: {
        instructor: { select: { id: true, name: true, image: true } },
        gradeLevel: { select: { id: true, nameAr: true, nameEn: true } },
        members: {
          orderBy: { joinedAt: "asc" },
          select: { id: true, joinedAt: true, student: { select: { id: true, name: true, email: true, image: true } } },
        },
        scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
    })
    if (!group) return NextResponse.json({ error: "Class not found" }, { status: 404 })
    if (!ORG_MANAGER_ROLES.includes(guard.role) && group.instructorId !== guard.session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json(group)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Get org class error:", error, "Failed to load class")
  }
}

// PATCH /api/organizations/[orgId]/classes/[groupId] (owner/manager)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const group = await loadOrgClass(params.orgId, params.groupId)
    if (!group) return NextResponse.json({ error: "Class not found" }, { status: 404 })
    const input = await parseClassInput(params.orgId, await readJson(request), true)
    if (input.capacity != null) {
      const count = await db.classGroupMember.count({ where: { groupId: group.id } })
      if (input.capacity < count) {
        return NextResponse.json(
          { error: `Capacity cannot be below the current ${count} students`, code: "capacity_below_members" },
          { status: 400 }
        )
      }
    }
    const updated = await db.classGroup.update({ where: { id: group.id }, data: input })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.class_updated",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Updated class "${updated.name}" in "${guard.org.name}"`,
      metadata: { organizationId: params.orgId, fields: Object.keys(input) },
    })
    return NextResponse.json(updated)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Update org class error:", error, "Failed to update class")
  }
}

// DELETE /api/organizations/[orgId]/classes/[groupId] (owner/manager)
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const group = await loadOrgClass(params.orgId, params.groupId)
    if (!group) return NextResponse.json({ error: "Class not found" }, { status: 404 })
    await db.classGroup.delete({ where: { id: group.id } })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.class_deleted",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Deleted class "${group.name}" from "${guard.org.name}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Delete org class error:", error, "Failed to delete class")
  }
}
