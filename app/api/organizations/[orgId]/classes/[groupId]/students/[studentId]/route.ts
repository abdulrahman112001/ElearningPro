import { NextResponse } from "next/server"
import { canManageGroup } from "@/lib/organization"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrg, serverError } from "../../../../../_lib"
import { loadOrgClass } from "../../../_validate"

type Params = { params: { orgId: string; groupId: string; studentId: string } }

// DELETE /api/organizations/[orgId]/classes/[groupId]/students/[studentId]
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ["OWNER", "MANAGER", "TEACHER"], { write: true })
    if (guard.error) return guard.error
    const group = await loadOrgClass(params.orgId, params.groupId)
    if (!group) return NextResponse.json({ error: "Class not found" }, { status: 404 })
    if (!(await canManageGroup(group.id, guard.session.user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const removed = await db.classGroupMember.deleteMany({
      where: { groupId: group.id, studentId: params.studentId },
    })
    if (!removed.count) return NextResponse.json({ error: "Student not in this class" }, { status: 404 })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.class_student_removed",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Removed a student from "${group.name}" (${guard.org.name})`,
      metadata: { organizationId: params.orgId, studentId: params.studentId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Remove class student error:", error, "Failed to remove student")
  }
}
