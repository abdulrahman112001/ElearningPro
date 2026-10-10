import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import type { OrganizationRole } from "@prisma/client"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { sendEmail } from "@/lib/email"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { INVITE_TTL_MS, appUrl, escapeHtml, requireOrg, serverError } from "../../_lib"

type Params = { params: { orgId: string } }

const ROLE_LABEL: Record<string, { ar: string; en: string }> = {
  MANAGER: { ar: "مدير", en: "manager" },
  TEACHER: { ar: "مدرس", en: "teacher" },
  STUDENT: { ar: "طالب", en: "student" },
}

// GET /api/organizations/[orgId]/invites: pending invites (owner/manager)
export async function GET(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES)
    if (guard.error) return guard.error
    const invites = await db.organizationInvite.findMany({
      where: { organizationId: params.orgId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true,
        createdBy: { select: { name: true } },
      },
    })
    return NextResponse.json(invites)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("List org invites error:", error, "Failed to load invites")
  }
}

// POST /api/organizations/[orgId]/invites { email, role }
export async function POST(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const limit = rateLimit({
      scope: "org-invite",
      identifier: guard.session.user.id,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.success) return tooManyRequests(limit.resetAt)

    const body = await readJson(request)
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const role = body.role as OrganizationRole
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
    }
    if (!["MANAGER", "TEACHER", "STUDENT"].includes(role)) {
      return NextResponse.json({ error: "role must be MANAGER, TEACHER or STUDENT" }, { status: 400 })
    }
    if (role === "MANAGER" && guard.role !== "OWNER") {
      return NextResponse.json({ error: "Only the owner can invite managers" }, { status: 403 })
    }
    const existingUser = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true },
    })
    if (existingUser) {
      const member = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: params.orgId, userId: existingUser.id } },
      })
      if (member) return NextResponse.json({ error: "Already a member", code: "already_member" }, { status: 409 })
    }

    const token = randomBytes(32).toString("base64url")
    const invite = await db.$transaction(async (tx) => {
      // A new invite replaces any earlier pending one for the same address.
      await tx.organizationInvite.deleteMany({
        where: { organizationId: params.orgId, email, acceptedAt: null },
      })
      return tx.organizationInvite.create({
        data: {
          organizationId: params.orgId,
          email,
          role,
          token,
          createdById: guard.session.user.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      })
    })

    const link = `${appUrl(request)}/org/invite/${token}`
    const orgName = escapeHtml(guard.org.name)
    const label = ROLE_LABEL[role]
    let emailSent = true
    try {
      await sendEmail({
        to: email,
        subject: `دعوة للانضمام إلى ${guard.org.name} | Invitation to join ${guard.org.name}`,
        html: `<div dir="rtl" style="font-family:sans-serif">
<p>تمت دعوتك للانضمام إلى <strong>${orgName}</strong> بصفة ${label.ar}.</p>
<p><a href="${link}">قبول الدعوة</a> (صالحة لمدة ٧ أيام)</p></div>
<hr/><div dir="ltr" style="font-family:sans-serif">
<p>You have been invited to join <strong>${orgName}</strong> as a ${label.en}.</p>
<p><a href="${link}">Accept the invitation</a> (valid for 7 days)</p></div>`,
      })
    } catch (e) {
      emailSent = false
      console.error("Org invite email failed:", e)
    }
    if (existingUser) {
      await db.notification.create({
        data: {
          userId: existingUser.id,
          type: "SYSTEM",
          title: `Invitation to join ${guard.org.name}`,
          message: `You were invited to join ${guard.org.name} as ${role}.`,
          link: `/org/invite/${token}`,
        },
      })
    }
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.invite_sent",
      entityType: "organization",
      entityId: params.orgId,
      summary: `Invited ${email} to "${guard.org.name}" as ${role}`,
      metadata: { email, role, inviteId: invite.id },
    })
    return NextResponse.json({ ...invite, link, emailSent }, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Create org invite error:", error, "Failed to send invite")
  }
}
