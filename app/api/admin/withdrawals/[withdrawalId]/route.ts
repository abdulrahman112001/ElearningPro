import { NextResponse } from "next/server"
import type { WithdrawalStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity"
import { ApiError, readJson, apiErrorResponse } from "@/lib/api-error"

/**
 * Allowed transitions. The amount is reserved (taken out of pendingEarnings)
 * when the instructor requests the withdrawal, so:
 *   - REJECTED gives the reserved amount back to pendingEarnings
 *   - COMPLETED moves it into paidEarnings
 * Both are terminal, which is what prevents paying the same request twice.
 */
const TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "COMPLETED"],
  APPROVED: ["REJECTED", "COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
}

// Process withdrawal (Admin only)
export async function PATCH(
  request: Request,
  { params }: { params: { withdrawalId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await readJson(request)
    const { status, note } = body as { status: WithdrawalStatus; note?: string }

    if (!["APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updatedWithdrawal = await db.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id: params.withdrawalId },
      })
      if (!withdrawal) throw new ApiError(404, "Withdrawal not found")

      const allowedFrom = (Object.keys(TRANSITIONS) as WithdrawalStatus[]).filter(
        (from) => TRANSITIONS[from].includes(status)
      )
      if (!allowedFrom.includes(withdrawal.status)) {
        throw new ApiError(
          400,
          `Cannot change a ${withdrawal.status} withdrawal to ${status}`
        )
      }

      // Compare-and-set: only one concurrent request can move the row out of
      // its current status. The losers update 0 rows and stop here, before
      // any money moves.
      const claimed = await tx.withdrawal.updateMany({
        where: { id: withdrawal.id, status: withdrawal.status },
        data: {
          status,
          note: note || withdrawal.note,
          processedAt: new Date(),
        },
      })
      if (claimed.count !== 1) {
        throw new ApiError(409, "Withdrawal was already processed")
      }

      if (status === "REJECTED") {
        await tx.instructorProfile.update({
          where: { userId: withdrawal.userId },
          data: { pendingEarnings: { increment: withdrawal.amount } },
        })
      }

      if (status === "COMPLETED") {
        await tx.instructorProfile.update({
          where: { userId: withdrawal.userId },
          data: { paidEarnings: { increment: withdrawal.amount } },
        })
      }

      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          type: "PAYMENT_RECEIVED",
          title:
            status === "COMPLETED"
              ? "Withdrawal Completed"
              : status === "APPROVED"
              ? "Withdrawal Approved"
              : "Withdrawal Rejected",
          message:
            status === "COMPLETED"
              ? `Your withdrawal of $${withdrawal.amount} has been processed.`
              : status === "APPROVED"
              ? `Your withdrawal of $${withdrawal.amount} has been approved and is being processed.`
              : `Your withdrawal of $${withdrawal.amount} has been rejected. ${
                  note || ""
                }`,
          link: "/instructor/earnings",
        },
      })

      return tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } })
    })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "withdrawal.processed",
      entityType: "withdrawal",
      entityId: updatedWithdrawal.id,
      summary: `Withdrawal of ${updatedWithdrawal.amount} marked ${status}`,
    })

    return NextResponse.json(updatedWithdrawal)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Process withdrawal error:", error)
    return NextResponse.json(
      { error: "Failed to process withdrawal" },
      { status: 500 }
    )
  }
}
