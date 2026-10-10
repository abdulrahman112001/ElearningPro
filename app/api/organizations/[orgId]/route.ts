import { NextResponse } from "next/server"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { parseOrgInput, requireOrg, serverError, slugTaken } from "../_lib"

type Params = { params: { orgId: string } }

// GET /api/organizations/[orgId]: details for any member
export async function GET(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId)
    if (guard.error) return guard.error
    const [byRole, classes, courses, pendingInvites] = await Promise.all([
      db.organizationMember.groupBy({
        by: ["role"],
        where: { organizationId: params.orgId },
        _count: { _all: true },
      }),
      db.classGroup.count({ where: { organizationId: params.orgId } }),
      db.course.count({ where: { organizationId: params.orgId } }),
      db.organizationInvite.count({
        where: { organizationId: params.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      }),
    ])
    return NextResponse.json({
      organization: guard.org,
      myRole: guard.role,
      stats: {
        members: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])),
        classes,
        courses,
        pendingInvites,
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Get organization error:", error, "Failed to load organization")
  }
}

// PATCH /api/organizations/[orgId]: settings & branding (owner/manager)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const body = await readJson(request)
    const input = parseOrgInput(body, true)
    if (input.slug && input.slug !== guard.org.slug && (await slugTaken(input.slug, guard.org.id))) {
      return NextResponse.json({ error: "This address is already taken", code: "slug_taken" }, { status: 409 })
    }
    if (input.type && input.type !== guard.org.type && guard.role !== "OWNER") {
      return NextResponse.json({ error: "Only the owner can change the organization type" }, { status: 403 })
    }
    const org = await db.organization.update({ where: { id: guard.org.id }, data: input })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.updated",
      entityType: "organization",
      entityId: org.id,
      summary: `Updated settings of "${org.name}"`,
      metadata: { fields: Object.keys(input) },
    })
    return NextResponse.json(org)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Update organization error:", error, "Failed to update organization")
  }
}
