import { NextResponse } from "next/server"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrg, serverError } from "../../_lib"
import { parseClassInput } from "./_validate"

type Params = { params: { orgId: string } }

// GET /api/organizations/[orgId]/classes: managers see all, teachers their own
export async function GET(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ["OWNER", "MANAGER", "TEACHER"])
    if (guard.error) return guard.error
    const classes = await db.classGroup.findMany({
      where: {
        organizationId: params.orgId,
        ...(ORG_MANAGER_ROLES.includes(guard.role) ? {} : { instructorId: guard.session.user.id }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        instructor: { select: { id: true, name: true, image: true } },
        gradeLevel: { select: { id: true, nameAr: true, nameEn: true } },
        _count: { select: { members: true, courses: true } },
      },
    })
    return NextResponse.json(classes)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("List org classes error:", error, "Failed to load classes")
  }
}

// POST /api/organizations/[orgId]/classes (owner/manager)
export async function POST(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const input = await parseClassInput(params.orgId, await readJson(request), false)
    const group = await db.classGroup.create({
      data: {
        ...input,
        name: input.name!,
        instructorId: input.instructorId!,
        organizationId: params.orgId,
      },
    })
    if (group.instructorId !== guard.session.user.id) {
      await db.notification.create({
        data: {
          userId: group.instructorId,
          type: "SYSTEM",
          title: `New class assigned: ${group.name}`,
          message: `${guard.org.name} assigned you to teach "${group.name}".`,
          link: `/instructor/groups/${group.id}`,
        },
      })
    }
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.class_created",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Created class "${group.name}" in "${guard.org.name}"`,
      metadata: { organizationId: params.orgId, instructorId: group.instructorId },
    })
    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Create org class error:", error, "Failed to create class")
  }
}
