import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"

type Params = { params: { orgId: string } }

// PATCH /api/admin/organizations/[orgId] { isApproved?: boolean, isActive?: boolean }
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireAdmin()
    if (error) return error
    const body = await readJson(request)
    const data: { isApproved?: boolean; isActive?: boolean } = {}
    if (body.isApproved !== undefined) {
      if (typeof body.isApproved !== "boolean") return NextResponse.json({ error: "isApproved must be boolean" }, { status: 400 })
      data.isApproved = body.isApproved
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 })
      data.isActive = body.isActive
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const before = await db.organization.findUnique({ where: { id: params.orgId } })
    if (!before) return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    const org = await db.organization.update({ where: { id: params.orgId }, data })

    const events: { action: string; title: string; message: string }[] = []
    if (data.isApproved === true && !before.isApproved) {
      events.push({
        action: "organization.approved",
        title: `${org.name} is approved`,
        message: `Your organization is approved; its public page is live at /o/${org.slug}.`,
      })
    }
    if (data.isApproved === false && before.isApproved) {
      events.push({
        action: "organization.unapproved",
        title: `${org.name} approval withdrawn`,
        message: "An admin withdrew the approval; the public page is hidden.",
      })
    }
    if (data.isActive === false && before.isActive) {
      events.push({
        action: "organization.suspended",
        title: `${org.name} is suspended`,
        message: "An admin suspended your organization. Contact support for details.",
      })
    }
    if (data.isActive === true && !before.isActive) {
      events.push({
        action: "organization.reactivated",
        title: `${org.name} is active again`,
        message: "An admin lifted the suspension of your organization.",
      })
    }
    for (const e of events) {
      await db.notification.create({
        data: { userId: org.ownerId, type: "SYSTEM", title: e.title, message: e.message, link: `/org/${org.id}` },
      })
      await logActivity({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: e.action as `${string}.${string}`,
        entityType: "organization",
        entityId: org.id,
        summary: `${e.action.split(".")[1]} "${org.name}"`,
      })
    }
    return NextResponse.json(org)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin update organization error:", error)
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}
