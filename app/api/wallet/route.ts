import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { getPaymentSettings } from "@/lib/payment-settings"

export const dynamic = "force-dynamic"

// GET /api/wallet: balance, recent transactions, own transfer requests and
// the platform's receiving accounts.
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id
    const [user, transactions, payments, receiving] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { walletBalance: true } }),
      db.walletTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
      db.manualPayment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          method: true,
          amount: true,
          reference: true,
          senderPhone: true,
          note: true,
          status: true,
          reviewNote: true,
          reviewedAt: true,
          createdAt: true,
        },
      }),
      getPaymentSettings(),
    ])
    return NextResponse.json({ balance: user?.walletBalance ?? 0, transactions, payments, receiving })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get wallet error:", error)
    return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 })
  }
}
