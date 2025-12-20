import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

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

    const body = await request.json()
    const { status, note } = body

    if (!["APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const withdrawal = await db.withdrawal.findUnique({
      where: { id: params.withdrawalId },
    })

    if (!withdrawal) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      )
    }

    // If rejecting, return amount to pending earnings
    if (status === "REJECTED" && withdrawal.status === "PENDING") {
      await db.instructorProfile.update({
        where: { userId: withdrawal.userId },
        data: {
          pendingEarnings: {
            increment: withdrawal.amount,
          },
        },
      })
    }

    // Update withdrawal
    const updatedWithdrawal = await db.withdrawal.update({
      where: { id: params.withdrawalId },
      data: {
        status,
        note: note || withdrawal.note,
        processedAt: new Date(),
      },
    })

    // Notify instructor
    await db.notification.create({
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

    return NextResponse.json(updatedWithdrawal)
  } catch (error) {
    console.error("Process withdrawal error:", error)
    return NextResponse.json(
      { error: "Failed to process withdrawal" },
      { status: 500 }
    )
  }
}
