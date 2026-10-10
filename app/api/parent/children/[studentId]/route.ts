import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { canViewChild, requireParent } from "@/lib/reports/parent-links"
import { getChildOverview } from "@/lib/reports/child-overview"

interface Ctx {
  params: { studentId: string }
}

/** Full overview of one linked child (admins may view any student). */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const guard = await requireParent()
    if (guard.error) return guard.error
    if (!(await canViewChild(guard.session, params.studentId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const overview = await getChildOverview(params.studentId)
    if (!overview) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(overview)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent child overview error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/** The parent removes their own link to a child. */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const guard = await requireParent()
    if (guard.error) return guard.error
    const { session } = guard
    if (session.user.role !== "PARENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const link = await db.parentLink.findUnique({
      where: { parentId_studentId: { parentId: session.user.id, studentId: params.studentId } },
      select: { id: true, student: { select: { name: true } } },
    })
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.parentLink.delete({ where: { id: link.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "parent.unlinked",
      entityType: "user",
      entityId: params.studentId,
      summary: `${session.user.name ?? "Parent"} unlinked from student ${link.student.name ?? params.studentId}`,
      metadata: { parentId: session.user.id, studentId: params.studentId, by: "parent" },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent unlink error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
