import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, apiErrorResponse, readJson } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"
import { creditWallet } from "@/lib/wallet"
import { logActivity } from "@/lib/activity"

// POST /api/admin/manual-payments/:id { action: "approve" | "reject", reason? }
// Approval moves PENDING -> APPROVED and credits the wallet in one
// transaction; only a PENDING request can change, so nothing is credited twice.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const g = await requireAdmin()
    if (g.error) return g.error
    const admin = g.session.user
    const body = await readJson(request)
    const action = body?.action
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 })
    }
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : ""
    if (action === "reject" && reason.length < 3) {
      return NextResponse.json({ error: "A rejection reason is required", code: "reason_required" }, { status: 400 })
    }

    const payment = await db.manualPayment.findUnique({ where: { id: params.id } })
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = new Date()
    const result = await db.$transaction(async (tx) => {
      const moved = await tx.manualPayment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: action === "approve" ? "APPROVED" : "REJECTED",
          reviewedById: admin.id,
          reviewedAt: now,
          reviewNote: reason || null,
        },
      })
      if (moved.count === 0) throw new ApiError(409, "This request was already reviewed", { code: "already_reviewed" })
      if (action === "approve") {
        const credit = await creditWallet(
          {
            userId: payment.userId,
            amount: payment.amount,
            reason: "transfer_approved",
            reference: payment.id,
            note: `${payment.method} ${payment.reference}`,
          },
          tx
        )
        return { balance: credit.balanceAfter as number | null }
      }
      return { balance: null as number | null }
    })

    await db.notification
      .create({
        data: {
          userId: payment.userId,
          type: "SYSTEM",
          title: action === "approve" ? "Transfer approved" : "Transfer rejected",
          message:
            action === "approve"
              ? `${payment.amount} EGP were added to your wallet.`
              : `Your transfer of ${payment.amount} EGP was not approved: ${reason}`,
          link: "/student/wallet",
        },
      })
      .catch(() => {})

    await logActivity({
      actorId: admin.id,
      actorRole: admin.role,
      action: action === "approve" ? "payment.manual_approved" : "payment.manual_rejected",
      entityType: "manualPayment",
      entityId: payment.id,
      summary:
        action === "approve"
          ? `Approved ${payment.method} transfer of ${payment.amount} EGP (ref ${payment.reference})`
          : `Rejected ${payment.method} transfer of ${payment.amount} EGP: ${reason}`,
      metadata: { userId: payment.userId, amount: payment.amount, method: payment.method, reference: payment.reference },
    })

    const updated = await db.manualPayment.findUnique({ where: { id: payment.id } })
    return NextResponse.json({ payment: updated, balance: result.balance })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Review manual payment error:", error)
    return NextResponse.json({ error: "Failed to review transfer" }, { status: 500 })
  }
}
