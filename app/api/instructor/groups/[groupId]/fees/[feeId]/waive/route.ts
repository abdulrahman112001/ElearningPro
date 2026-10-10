import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireGroupManager } from "@/lib/attendance"

type Params = { params: { groupId: string; feeId: string } }

// POST /api/instructor/groups/:id/fees/:feeId/waive { note }: exempts a due fee
export async function POST(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const fee = await db.groupFee.findFirst({
      where: { id: params.feeId, groupId: params.groupId },
      include: { student: { select: { name: true } } },
    })
    if (!fee) return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    const { note } = await readJson(request)
    if (typeof note !== "string" || !note.trim() || note.length > 500) {
      return NextResponse.json({ error: "A note explaining the waiver is required", code: "note_required" }, { status: 400 })
    }
    const { count } = await db.groupFee.updateMany({
      where: { id: fee.id, status: "DUE" },
      data: { status: "WAIVED", note: note.trim(), recordedById: session.user.id, method: null },
    })
    if (count === 0) return NextResponse.json({ error: "This fee is not due", code: "not_due" }, { status: 409 })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "fee.waived",
      entityType: "groupFee",
      entityId: fee.id,
      summary: `Waived the ${fee.period} fee of ${fee.student.name ?? "a student"}: ${note.trim().slice(0, 120)}`,
      metadata: { groupId: params.groupId, amount: fee.amount, period: fee.period },
    })
    return NextResponse.json(await db.groupFee.findUniqueOrThrow({ where: { id: fee.id } }))
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Waive fee error:", error)
    return NextResponse.json({ error: "Failed to waive the fee" }, { status: 500 })
  }
}
