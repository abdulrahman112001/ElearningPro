import { NextResponse } from "next/server"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrg, serverError } from "../../../_lib"

type Params = { params: { orgId: string; courseId: string } }

// DELETE /api/organizations/[orgId]/courses/[courseId]: detach (course owner or org manager)
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ["OWNER", "MANAGER", "TEACHER"], { write: true })
    if (guard.error) return guard.error
    const course = await db.course.findFirst({
      where: { id: params.courseId, organizationId: params.orgId },
      select: { id: true, titleAr: true, titleEn: true, instructorId: true },
    })
    if (!course) return NextResponse.json({ error: "Course not found in this organization" }, { status: 404 })
    if (course.instructorId !== guard.session.user.id && !ORG_MANAGER_ROLES.includes(guard.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    await db.course.update({ where: { id: course.id }, data: { organizationId: null } })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.course_detached",
      entityType: "course",
      entityId: course.id,
      summary: `Detached "${course.titleAr || course.titleEn}" from "${guard.org.name}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Detach org course error:", error, "Failed to detach course")
  }
}
