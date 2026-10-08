import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"

type Params = { params: { groupId: string } }

/** The group if it belongs to the instructor (admins may open any group). */
async function findOwnedGroup(groupId: string, userId: string, role: string) {
  return db.classGroup.findFirst({
    where: { id: groupId, ...(role === "ADMIN" ? {} : { instructorId: userId }) },
  })
}

// GET /api/instructor/groups/:id: group with members and attached courses
export async function GET(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const group = await db.classGroup.findFirst({
      where: {
        id: params.groupId,
        ...(session.user.role === "ADMIN" ? {} : { instructorId: session.user.id }),
      },
      include: {
        gradeLevel: { select: { id: true, nameAr: true, nameEn: true } },
        members: {
          orderBy: { joinedAt: "desc" },
          include: { student: { select: { id: true, name: true, email: true, image: true } } },
        },
        courses: { select: { id: true, titleAr: true, titleEn: true, slug: true, status: true } },
      },
    })
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })
    return NextResponse.json(group)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get group error:", error)
    return NextResponse.json({ error: "Failed to get group" }, { status: 500 })
  }
}

// PATCH /api/instructor/groups/:id { name?, description?, gradeLevelId? }
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const group = await findOwnedGroup(params.groupId, session.user.id, session.user.role)
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    const { name, description, gradeLevelId } = await readJson(request)
    if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 100)) {
      return NextResponse.json({ error: "Invalid group name" }, { status: 400 })
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ error: "description must be text" }, { status: 400 })
    }
    if (gradeLevelId && !(await db.gradeLevel.findUnique({ where: { id: gradeLevelId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Grade level not found" }, { status: 404 })
    }
    const updated = await db.classGroup.update({
      where: { id: group.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(gradeLevelId !== undefined && { gradeLevelId: gradeLevelId || null }),
      },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "group.updated",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Updated group "${updated.name}"`,
    })
    return NextResponse.json(updated)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update group error:", error)
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
  }
}

// DELETE /api/instructor/groups/:id: attached courses become open to all again
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const group = await findOwnedGroup(params.groupId, session.user.id, session.user.role)
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })
    await db.classGroup.delete({ where: { id: group.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "group.deleted",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Deleted group "${group.name}"`,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete group error:", error)
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
  }
}
