import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { GROUP_MODES, requireGroupManager } from "@/lib/attendance"

type Params = { params: { groupId: string } }

// GET /api/instructor/groups/:id: group with members and attached courses.
// Open to whoever manages the group (teacher, org owner/manager, admin).
export async function GET(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error.status === 403 ? NextResponse.json({ error: "Group not found" }, { status: 404 }) : error
    const group = await db.classGroup.findUnique({
      where: { id: params.groupId },
      include: {
        gradeLevel: { select: { id: true, nameAr: true, nameEn: true } },
        organization: { select: { id: true, name: true } },
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

// PATCH /api/instructor/groups/:id
// { name?, description?, gradeLevelId?, mode?, location?, monthlyFee?, capacity? }
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error.status === 403 ? NextResponse.json({ error: "Group not found" }, { status: 404 }) : error
    const group = await db.classGroup.findUniqueOrThrow({ where: { id: params.groupId } })

    const { name, description, gradeLevelId, mode, location, monthlyFee, capacity } = await readJson(request)
    if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 100)) {
      return NextResponse.json({ error: "Invalid group name" }, { status: 400 })
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ error: "description must be text" }, { status: 400 })
    }
    if (mode !== undefined && !(GROUP_MODES as readonly string[]).includes(mode)) {
      return NextResponse.json({ error: "mode must be ONLINE, OFFLINE or HYBRID" }, { status: 400 })
    }
    if (location !== undefined && location !== null && (typeof location !== "string" || location.length > 300)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 })
    }
    if (
      monthlyFee !== undefined &&
      (typeof monthlyFee !== "number" || !Number.isFinite(monthlyFee) || monthlyFee < 0 || monthlyFee > 100000)
    ) {
      return NextResponse.json({ error: "monthlyFee must be between 0 and 100000" }, { status: 400 })
    }
    if (
      capacity !== undefined &&
      capacity !== null &&
      (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
    ) {
      return NextResponse.json({ error: "capacity must be a whole number between 1 and 10000" }, { status: 400 })
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
        ...(mode !== undefined && { mode }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(monthlyFee !== undefined && { monthlyFee: Math.round(monthlyFee * 100) / 100 }),
        ...(capacity !== undefined && { capacity }),
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
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error.status === 403 ? NextResponse.json({ error: "Group not found" }, { status: 404 }) : error
    const group = await db.classGroup.findUniqueOrThrow({ where: { id: params.groupId } })
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
