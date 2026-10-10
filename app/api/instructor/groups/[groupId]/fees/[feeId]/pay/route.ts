import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireGroupManager } from "@/lib/attendance"
import { markFeePaid, withReceiptNo } from "@/lib/fees"

type Params = { params: { groupId: string; feeId: string } }

// POST /api/instructor/groups/:id/fees/:feeId/pay { note? }: records a cash payment
export async function POST(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const fee = await db.groupFee.findFirst({
      where: { id: params.feeId, groupId: params.groupId },
      include: { student: { select: { id: true, name: true } }, group: { select: { name: true } } },
    })
    if (!fee) return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    const { note } = await readJson(request)
    if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 500)) {
      return NextResponse.json({ error: "Invalid note" }, { status: 400 })
    }
    if (fee.status !== "DUE") {
      return NextResponse.json({ error: "This fee is not due", code: "not_due", status: fee.status }, { status: 409 })
    }

    const paid = await withReceiptNo((receiptNo) =>
      db.$transaction(async (tx) => {
        const ok = await markFeePaid(tx, fee.id, {
          method: "CASH",
          receiptNo,
          recordedById: session.user.id,
          ...(note !== undefined && { note: note?.trim() || null }),
        })
        return ok ? tx.groupFee.findUniqueOrThrow({ where: { id: fee.id } }) : null
      })
    )
    if (!paid) return NextResponse.json({ error: "This fee is not due", code: "not_due" }, { status: 409 })

    await db.notification.create({
      data: {
        userId: fee.studentId,
        type: "PAYMENT_RECEIVED",
        title: "تم استلام المصروفات",
        message: `تم تسجيل دفع مصروفات شهر ${fee.period} لمجموعة "${fee.group.name}" (إيصال ${paid.receiptNo}).`,
        link: "/student/attendance",
      },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "fee.paid",
      entityType: "groupFee",
      entityId: fee.id,
      summary: `Cash payment of ${fee.amount} EGP from ${fee.student.name ?? "a student"} for ${fee.period} (${paid.receiptNo})`,
      metadata: { groupId: params.groupId, method: "CASH", amount: fee.amount, receiptNo: paid.receiptNo },
    })
    return NextResponse.json(paid)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Record fee payment error:", error)
    return NextResponse.json({ error: "Failed to record the payment" }, { status: 500 })
  }
}
