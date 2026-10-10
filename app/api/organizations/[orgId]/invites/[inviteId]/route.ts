import { NextResponse } from "next/server"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrg, serverError } from "../../../_lib"

type Params = { params: { orgId: string; inviteId: string } }

// DELETE /api/organizations/[orgId]/invites/[inviteId]: revoke a pending invite
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const invite = await db.organizationInvite.findFirst({
      where: { id: params.inviteId, organizationId: params.orgId },
    })
    if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "This invite was already accepted", code: "invite_used" }, { status: 409 })
    }
    await db.organizationInvite.delete({ where: { id: invite.id } })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.invite_revoked",
      entityType: "organization",
      entityId: params.orgId,
      summary: `Revoked the invite for ${invite.email} to "${guard.org.name}"`,
      metadata: { email: invite.email, role: invite.role },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Revoke org invite error:", error, "Failed to revoke invite")
  }
}
