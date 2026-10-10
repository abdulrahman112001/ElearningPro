import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"

export const dynamic = "force-dynamic"

// GET /api/wallet/balance: just the balance (used by pay buttons).
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { walletBalance: true } })
    return NextResponse.json({ balance: user?.walletBalance ?? 0 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Wallet balance error:", error)
    return NextResponse.json({ error: "Failed to load balance" }, { status: 500 })
  }
}
