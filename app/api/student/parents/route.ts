import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireStudent } from "@/lib/reports/parent-links"

/** Parents linked to the signed-in student. */
export async function GET() {
  try {
    const guard = await requireStudent()
    if (guard.error) return guard.error
    const links = await db.parentLink.findMany({
      where: { studentId: guard.session.user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        relation: true,
        status: true,
        createdAt: true,
        parent: { select: { id: true, name: true, email: true, image: true } },
      },
    })
    return NextResponse.json({ parents: links })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Student parents error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/** Removes a parent link: DELETE /api/student/parents?parentId=... */
export async function DELETE(request: Request) {
  try {
    const guard = await requireStudent()
    if (guard.error) return guard.error
    const studentId = guard.session.user.id
    const parentId = new URL(request.url).searchParams.get("parentId")
    if (!parentId) return NextResponse.json({ error: "parentId is required" }, { status: 400 })

    const link = await db.parentLink.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { id: true, parent: { select: { name: true } } },
    })
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.parentLink.delete({ where: { id: link.id } })
    const studentName = guard.session.user.name ?? "Student"
    await db.notification.create({
      data: {
        userId: parentId,
        type: "SYSTEM",
        title: "تم إلغاء الربط",
        message: `قام ${studentName} بإلغاء ربط حسابه بحسابك.`,
        link: "/parent",
      },
    })
    await logActivity({
      actorId: studentId,
      actorRole: guard.session.user.role,
      action: "parent.unlinked",
      entityType: "user",
      entityId: studentId,
      summary: `${studentName} removed parent ${link.parent.name ?? parentId}`,
      metadata: { parentId, studentId, by: "student" },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Student remove parent error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
