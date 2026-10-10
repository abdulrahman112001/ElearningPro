import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { debitWallet, InsufficientBalanceError } from "@/lib/wallet"
import { markFeePaid, withReceiptNo } from "@/lib/fees"

class NotDueError extends Error {}

// POST /api/fees/:feeId/pay-wallet: the student pays a due group fee from the
// wallet. Debit and status change happen in one transaction.
export async function POST(request: Request, { params }: { params: { feeId: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const limit = rateLimit({ scope: "fee-pay-wallet", identifier: session.user.id, limit: 10, windowMs: 60_000 })
    if (!limit.success) return tooManyRequests(limit.resetAt)

    const fee = await db.groupFee.findUnique({
      where: { id: params.feeId },
      include: { group: { select: { id: true, name: true, instructorId: true } }, student: { select: { name: true } } },
    })
    if (!fee || fee.studentId !== session.user.id) return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    if (fee.status !== "DUE") {
      return NextResponse.json({ error: "This fee is not due", code: "not_due", status: fee.status }, { status: 409 })
    }

    let paid
    try {
      paid = await withReceiptNo((receiptNo) =>
        db.$transaction(async (tx) => {
          const ok = await markFeePaid(tx, fee.id, { method: "WALLET", receiptNo, recordedById: session.user.id })
          if (!ok) throw new NotDueError()
          await debitWallet(
            {
              userId: session.user.id,
              amount: fee.amount,
              reason: "group_fee",
              reference: fee.id,
              note: `${fee.group.name} ${fee.period} (${receiptNo})`,
            },
            tx
          )
          return tx.groupFee.findUniqueOrThrow({ where: { id: fee.id } })
        })
      )
    } catch (e) {
      if (e instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: "Insufficient wallet balance", code: "insufficient_balance", balance: e.balance, required: e.required },
          { status: 402 }
        )
      }
      if (e instanceof NotDueError) return NextResponse.json({ error: "This fee is not due", code: "not_due" }, { status: 409 })
      throw e
    }

    await db.notification.create({
      data: {
        userId: fee.group.instructorId,
        type: "PAYMENT_RECEIVED",
        title: "دفع مصروفات من المحفظة",
        message: `${fee.student.name ?? "طالب"} دفع ${fee.amount} جنيه مصروفات شهر ${fee.period} لمجموعة "${fee.group.name}".`,
        link: `/instructor/groups/${fee.group.id}/fees?period=${fee.period}`,
      },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "fee.paid",
      entityType: "groupFee",
      entityId: fee.id,
      summary: `Wallet payment of ${fee.amount} EGP for ${fee.period} in "${fee.group.name}" (${paid.receiptNo})`,
      metadata: { groupId: fee.group.id, method: "WALLET", amount: fee.amount, receiptNo: paid.receiptNo },
    })
    return NextResponse.json(paid)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Wallet fee payment error:", error)
    return NextResponse.json({ error: "Payment failed" }, { status: 500 })
  }
}
