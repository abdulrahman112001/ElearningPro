import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests, getClientIp } from "@/lib/rate-limit"
import { accountFitsOrgRole, orgManagerIds, serverError } from "../../_lib"

type Params = { params: { token: string } }

async function findInvite(token: string) {
  if (!token || token.length > 100) return null
  return db.organizationInvite.findUnique({
    where: { token },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, type: true, logoUrl: true, primaryColor: true, isActive: true },
      },
    },
  })
}

function inviteState(invite: { acceptedAt: Date | null; expiresAt: Date }) {
  if (invite.acceptedAt) return "used" as const
  if (invite.expiresAt.getTime() <= Date.now()) return "expired" as const
  return "pending" as const
}

// GET /api/organizations/invites/[token]: what the invite is for
export async function GET(request: Request, { params }: Params) {
  try {
    const limit = rateLimit({ scope: "org-invite-view", identifier: getClientIp(request), limit: 60, windowMs: 60_000 })
    if (!limit.success) return tooManyRequests(limit.resetAt)
    const invite = await findInvite(params.token)
    if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    return NextResponse.json({
      organization: invite.organization,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
      state: inviteState(invite),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Get org invite error:", error, "Failed to load invite")
  }
}

// POST /api/organizations/invites/[token]: accept (signed in as the invited email)
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const invite = await findInvite(params.token)
    if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    const state = inviteState(invite)
    if (state === "used") {
      return NextResponse.json({ error: "This invite was already used", code: "invite_used" }, { status: 410 })
    }
    if (state === "expired") {
      return NextResponse.json({ error: "This invite has expired", code: "invite_expired" }, { status: 410 })
    }
    if (!invite.organization.isActive) {
      return NextResponse.json({ error: "This organization is suspended", code: "organization_suspended" }, { status: 403 })
    }
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true },
    })
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.email.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address", code: "email_mismatch" },
        { status: 403 }
      )
    }
    if (!accountFitsOrgRole(user.role, invite.role)) {
      return NextResponse.json(
        {
          error:
            invite.role === "STUDENT"
              ? "Student invites need a student account"
              : "Teacher and manager invites need a teacher account",
          code: "account_role_mismatch",
        },
        { status: 403 }
      )
    }
    const existing = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
    })
    if (existing) {
      return NextResponse.json({ error: "You are already a member", code: "already_member" }, { status: 409 })
    }

    // Single use: only the request that flips acceptedAt gets the membership.
    const member = await db.$transaction(async (tx) => {
      const claimed = await tx.organizationInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      })
      if (claimed.count !== 1) return null
      return tx.organizationMember.create({
        data: { organizationId: invite.organizationId, userId: user.id, role: invite.role },
      })
    })
    if (!member) {
      return NextResponse.json({ error: "This invite was already used", code: "invite_used" }, { status: 410 })
    }

    const managers = (await orgManagerIds(invite.organizationId)).filter((id) => id !== user.id)
    if (managers.length) {
      await db.notification.createMany({
        data: managers.map((id) => ({
          userId: id,
          type: "SYSTEM" as const,
          title: "Invitation accepted",
          message: `${user.name ?? user.email} joined ${invite.organization.name} as ${invite.role}.`,
          link: `/org/${invite.organizationId}/members`,
        })),
      })
    }
    await logActivity({
      actorId: user.id,
      actorRole: session.user.role,
      action: "organization.invite_accepted",
      entityType: "organization",
      entityId: invite.organizationId,
      summary: `${user.name ?? user.email} joined "${invite.organization.name}" as ${invite.role}`,
      metadata: { role: invite.role, inviteId: invite.id },
    })
    const redirect = invite.role === "STUDENT" ? "/student/organizations" : `/org/${invite.organizationId}`
    return NextResponse.json({ ok: true, member, redirect })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Accept org invite error:", error, "Failed to accept invite")
  }
}
