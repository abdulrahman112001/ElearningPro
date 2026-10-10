import { NextResponse } from "next/server"
import { canManageGroup } from "@/lib/organization"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrg, serverError } from "../../../../_lib"
import { loadOrgClass } from "../../_validate"

type Params = { params: { orgId: string; groupId: string } }

// POST /api/organizations/[orgId]/classes/[groupId]/students { userId }
// Adds an organization STUDENT member to the class (managers or the class teacher).
export async function POST(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ["OWNER", "MANAGER", "TEACHER"], { write: true })
    if (guard.error) return guard.error
    const group = await loadOrgClass(params.orgId, params.groupId)
    if (!group) return NextResponse.json({ error: "Class not found" }, { status: 404 })
    if (!(await canManageGroup(group.id, guard.session.user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { userId } = await readJson(request)
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }
    const membership = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: params.orgId, userId } },
      select: { role: true },
    })
    if (!membership || membership.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students of this organization can join its classes", code: "not_org_student" },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      const exists = await tx.classGroupMember.findUnique({
        where: { groupId_studentId: { groupId: group.id, studentId: userId } },
      })
      if (exists) return { status: "exists" as const }
      if (group.capacity != null) {
        const count = await tx.classGroupMember.count({ where: { groupId: group.id } })
        if (count >= group.capacity) return { status: "full" as const }
      }
      const row = await tx.classGroupMember.create({ data: { groupId: group.id, studentId: userId } })
      return { status: "created" as const, row }
    })
    if (result.status === "exists") {
      return NextResponse.json({ error: "Already in this class", code: "already_in_class" }, { status: 409 })
    }
    if (result.status === "full") {
      return NextResponse.json({ error: "This class is full", code: "class_full" }, { status: 409 })
    }

    await db.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: `Added to ${group.name}`,
        message: `${guard.org.name} added you to the class "${group.name}".`,
        link: "/student/organizations",
      },
    })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.class_student_added",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Added a student to "${group.name}" (${guard.org.name})`,
      metadata: { organizationId: params.orgId, studentId: userId },
    })
    return NextResponse.json(result.row, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Add class student error:", error, "Failed to add student")
  }
}
