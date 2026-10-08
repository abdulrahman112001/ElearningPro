import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"

// GET /api/instructor/groups: the instructor's class groups
export async function GET() {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const groups = await db.classGroup.findMany({
      where: { instructorId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        gradeLevel: { select: { id: true, nameAr: true, nameEn: true } },
        _count: { select: { members: true, courses: true } },
      },
    })
    return NextResponse.json(groups)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get groups error:", error)
    return NextResponse.json({ error: "Failed to get groups" }, { status: 500 })
  }
}

// POST /api/instructor/groups { name, description?, gradeLevelId? }
export async function POST(request: Request) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const { name, description, gradeLevelId } = await readJson(request)
    if (typeof name !== "string" || !name.trim() || name.length > 100) {
      return NextResponse.json({ error: "Group name is required (max 100 characters)" }, { status: 400 })
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ error: "description must be text" }, { status: 400 })
    }
    if (gradeLevelId && !(await db.gradeLevel.findUnique({ where: { id: gradeLevelId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Grade level not found" }, { status: 404 })
    }
    const group = await db.classGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        gradeLevelId: gradeLevelId || null,
        instructorId: session.user.id,
      },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "group.created",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Created group "${group.name}"`,
    })
    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create group error:", error)
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
  }
}
