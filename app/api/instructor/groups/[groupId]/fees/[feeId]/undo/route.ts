import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { creditWallet } from "@/lib/wallet"
import { requireGroupManager } from "@/lib/attendance"
import { canUndoFee } from "@/lib/fees"

type Params = { params: { groupId: string; feeId: string } }

// POST /api/instructor/groups/:id/fees/:feeId/undo: puts a paid/waived fee back
// to DUE. Admins and organization owners only (a wallet payment is refunded).
export async function POST(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error
    if (!(await canUndoFee(params.groupId, session.user))) {
      return NextResponse.json({ error: "Only the owner or an admin can undo a payment", code: "forbidden" }, { status: 403 })
    }
    const fee = await db.groupFee.findFirst({
      where: { id: params.feeId, groupId: params.groupId },
      include: { student: { select: { name: true } } },
    })
    if (!fee) return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    if (fee.status === "DUE") return NextResponse.json({ error: "This fee is already due", code: "already_due" }, { status: 409 })

    const updated = await db.$transaction(async (tx) => {
      const { count } = await tx.groupFee.updateMany({
        where: { id: fee.id, status: fee.status },
        data: { status: "DUE", method: null, paidAt: null, receiptNo: null, recordedById: session.user.id },
      })
      if (count === 0) return null
      if (fee.status === "PAID" && fee.method === "WALLET") {
        await creditWallet(
          { userId: fee.studentId, amount: fee.amount, reason: "refund", reference: fee.id, note: fee.receiptNo ?? undefined },
          tx
        )
      }
      return tx.groupFee.findUniqueOrThrow({ where: { id: fee.id } })
    })
    if (!updated) return NextResponse.json({ error: "The fee changed, reload and try again" }, { status: 409 })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "fee.reverted",
      entityType: "groupFee",
      entityId: fee.id,
      summary: `Reverted the ${fee.period} fee of ${fee.student.name ?? "a student"} from ${fee.status} to DUE`,
      metadata: { groupId: params.groupId, previousStatus: fee.status, method: fee.method, receiptNo: fee.receiptNo },
    })
    return NextResponse.json(updated)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Undo fee error:", error)
    return NextResponse.json({ error: "Failed to undo" }, { status: 500 })
  }
}
