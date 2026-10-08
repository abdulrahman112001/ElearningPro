import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"

const STAGES = ["primary", "preparatory", "secondary", "university", "other"]

// PATCH /api/admin/grade-levels/:id
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await readJson(request)
    const data: Record<string, unknown> = {}
    for (const key of ["nameAr", "nameEn"] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "string" || !body[key].trim()) {
          return NextResponse.json({ error: `${key} must be non-empty text` }, { status: 400 })
        }
        data[key] = body[key].trim()
      }
    }
    if (body.stage !== undefined) {
      if (body.stage !== null && !STAGES.includes(body.stage)) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
      }
      data.stage = body.stage
    }
    if (body.position !== undefined) {
      if (!Number.isInteger(body.position)) return NextResponse.json({ error: "position must be an integer" }, { status: 400 })
      data.position = body.position
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 })
      data.isActive = body.isActive
    }

    const grade = await db.gradeLevel.update({ where: { id: params.id }, data })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "grade.updated",
      entityType: "gradeLevel",
      entityId: grade.id,
      summary: `Updated grade "${grade.nameEn}"`,
    })
    return NextResponse.json(grade)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin update grade error:", error)
    return NextResponse.json({ error: "Failed to update grade level" }, { status: 500 })
  }
}

// DELETE /api/admin/grade-levels/:id — courses/students keep working (relation set to null)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const grade = await db.gradeLevel.delete({ where: { id: params.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "grade.deleted",
      entityType: "gradeLevel",
      entityId: grade.id,
      summary: `Deleted grade "${grade.nameEn}"`,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin delete grade error:", error)
    return NextResponse.json({ error: "Failed to delete grade level" }, { status: 500 })
  }
}
