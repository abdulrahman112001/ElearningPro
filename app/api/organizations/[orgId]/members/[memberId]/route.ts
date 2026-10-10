import { NextResponse } from "next/server"
import type { OrganizationRole } from "@prisma/client"
import { ORG_MANAGER_ROLES } from "@/lib/organization"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { accountFitsOrgRole, requireOrg, serverError } from "../../../_lib"

type Params = { params: { orgId: string; memberId: string } }

async function loadMember(orgId: string, memberId: string) {
  return db.organizationMember.findFirst({
    where: { id: memberId, organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  })
}

// PATCH /api/organizations/[orgId]/members/[memberId] { role?, title? }
export async function PATCH(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ORG_MANAGER_ROLES, { write: true })
    if (guard.error) return guard.error
    const member = await loadMember(params.orgId, params.memberId)
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })
    const body = await readJson(request)
    const data: { role?: OrganizationRole; title?: string | null } = {}

    if (body.title !== undefined) {
      if (body.title !== null && (typeof body.title !== "string" || body.title.length > 100)) {
        return NextResponse.json({ error: "title must be text (max 100)" }, { status: 400 })
      }
      if (member.role === "OWNER" && guard.role !== "OWNER") {
        return NextResponse.json({ error: "Managers cannot change the owner" }, { status: 403 })
      }
      data.title = body.title?.trim() || null
    }

    if (body.role !== undefined && body.role !== member.role) {
      const role = body.role as OrganizationRole
      if (!["MANAGER", "TEACHER", "STUDENT"].includes(role)) {
        return NextResponse.json({ error: "Invalid role (ownership cannot be transferred here)" }, { status: 400 })
      }
      if (member.role === "OWNER") {
        return NextResponse.json({ error: "The owner's role cannot be changed", code: "owner_locked" }, { status: 403 })
      }
      if ((role === "MANAGER" || member.role === "MANAGER") && guard.role !== "OWNER") {
        return NextResponse.json({ error: "Only the owner can promote or demote managers" }, { status: 403 })
      }
      if (!accountFitsOrgRole(member.user.role, role)) {
        return NextResponse.json(
          { error: `This account cannot hold the ${role} role`, code: "role_mismatch" },
          { status: 400 }
        )
      }
      if (role === "STUDENT") {
        const teaching = await db.classGroup.count({
          where: { organizationId: params.orgId, instructorId: member.userId },
        })
        if (teaching) {
          return NextResponse.json(
            { error: "Reassign this teacher's classes first", code: "teacher_has_classes" },
            { status: 409 }
          )
        }
      }
      data.role = role
    }

    if (!Object.keys(data).length) return NextResponse.json(member)
    const updated = await db.organizationMember.update({ where: { id: member.id }, data })
    if (data.role) {
      await db.notification.create({
        data: {
          userId: member.userId,
          type: "SYSTEM",
          title: `Your role in ${guard.org.name} changed`,
          message: `You are now ${data.role} in ${guard.org.name}.`,
          link: `/org/${params.orgId}`,
        },
      })
      await logActivity({
        actorId: guard.session.user.id,
        actorRole: guard.session.user.role,
        action: "organization.member_role_changed",
        entityType: "organization",
        entityId: params.orgId,
        summary: `${member.user.name ?? member.user.email}: ${member.role} -> ${data.role} in "${guard.org.name}"`,
        metadata: { userId: member.userId, from: member.role, to: data.role },
      })
    }
    return NextResponse.json(updated)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Update org member error:", error, "Failed to update member")
  }
}

// DELETE /api/organizations/[orgId]/members/[memberId]
// Managers remove members; any member may remove themselves (leave).
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, undefined, { write: true })
    if (guard.error) return guard.error
    const member = await loadMember(params.orgId, params.memberId)
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })
    const self = member.userId === guard.session.user.id
    if (!self && !ORG_MANAGER_ROLES.includes(guard.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (member.role === "OWNER") {
      return NextResponse.json({ error: "The owner cannot be removed", code: "owner_locked" }, { status: 403 })
    }
    if (member.role === "MANAGER" && !self && guard.role !== "OWNER") {
      return NextResponse.json({ error: "Only the owner can remove managers" }, { status: 403 })
    }
    const teaching = await db.classGroup.count({
      where: { organizationId: params.orgId, instructorId: member.userId },
    })
    if (teaching) {
      return NextResponse.json(
        { error: "Reassign this teacher's classes first", code: "teacher_has_classes" },
        { status: 409 }
      )
    }

    await db.$transaction([
      db.classGroupMember.deleteMany({
        where: { studentId: member.userId, group: { organizationId: params.orgId } },
      }),
      db.organizationMember.delete({ where: { id: member.id } }),
    ])
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: self ? "organization.member_left" : "organization.member_removed",
      entityType: "organization",
      entityId: params.orgId,
      summary: `${member.user.name ?? member.user.email} ${self ? "left" : "was removed from"} "${guard.org.name}"`,
      metadata: { userId: member.userId, role: member.role },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Remove org member error:", error, "Failed to remove member")
  }
}
