import { NextResponse } from "next/server"
import type { OrganizationRole } from "@prisma/client"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { accountFitsOrgRole, requireOrg, serverError } from "../../_lib"

type Params = { params: { orgId: string } }

// GET /api/organizations/[orgId]/members (owner/manager)
export async function GET(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES)
    if (guard.error) return guard.error
    const role = new URL(request.url).searchParams.get("role")
    const members = await db.organizationMember.findMany({
      where: {
        organizationId: params.orgId,
        ...(role && ["OWNER", "MANAGER", "TEACHER", "STUDENT"].includes(role)
          ? { role: role as OrganizationRole }
          : {}),
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      select: {
        id: true, role: true, title: true, joinedAt: true,
        user: { select: { id: true, name: true, email: true, image: true, role: true, phone: true } },
      },
    })
    return NextResponse.json(members)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("List org members error:", error, "Failed to load members")
  }
}

// POST /api/organizations/[orgId]/members { email, role?: "STUDENT" }
// Adds an existing student account directly (e.g. after a join request).
// Teachers and managers join through invites so they accept themselves.
export async function POST(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const body = await readJson(request)
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const role: OrganizationRole = body.role ?? "STUDENT"
    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 })
    if (role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can be added directly; invite teachers and managers", code: "invite_required" },
        { status: 400 }
      )
    }
    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true, role: true },
    })
    if (!user) return NextResponse.json({ error: "No account with this email", code: "user_not_found" }, { status: 404 })
    if (!accountFitsOrgRole(user.role, role)) {
      return NextResponse.json({ error: "This account is not a student account", code: "role_mismatch" }, { status: 400 })
    }
    const existing = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: params.orgId, userId: user.id } },
    })
    if (existing) return NextResponse.json({ error: "Already a member", code: "already_member" }, { status: 409 })

    const member = await db.organizationMember.create({
      data: { organizationId: params.orgId, userId: user.id, role },
    })
    await db.notification.create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: `You joined ${guard.org.name}`,
        message: `${guard.org.name} added you as a student.`,
        link: "/student/organizations",
      },
    })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.member_added",
      entityType: "organization",
      entityId: params.orgId,
      summary: `Added ${user.name ?? email} to "${guard.org.name}" as ${role}`,
      metadata: { userId: user.id, role },
    })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Add org member error:", error, "Failed to add member")
  }
}
