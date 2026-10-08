import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"

// DELETE /api/instructor/groups/:groupId/members/:studentId
export async function DELETE(
  request: Request,
  { params }: { params: { groupId: string; studentId: string } }
) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const group = await db.classGroup.findFirst({
      where: {
        id: params.groupId,
        ...(session.user.role === "ADMIN" ? {} : { instructorId: session.user.id }),
      },
    })
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    const { count } = await db.classGroupMember.deleteMany({
      where: { groupId: group.id, studentId: params.studentId },
    })
    if (count === 0) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "group.member_removed",
      entityType: "classGroup",
      entityId: group.id,
      summary: `Removed a student from "${group.name}"`,
      metadata: { studentId: params.studentId },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Remove group member error:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}
