import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { hitRedeemLimit, redeemCode } from "@/lib/codes"

const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 10

// POST /api/codes/redeem { code }: a student redeems an access code.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can redeem codes", code: "students_only" }, { status: 403 })
    }

    // Brute-force guard: every attempt counts, per account and per address.
    const userLocked = hitRedeemLimit(`user:${session.user.id}`, LIMIT, WINDOW_MS)
    if (userLocked) return tooManyRequests(userLocked)
    const ip = getClientIp(request)
    if (ip !== "unknown") {
      const ipLocked = hitRedeemLimit(`ip:${ip}`, LIMIT, WINDOW_MS)
      if (ipLocked) return tooManyRequests(ipLocked)
    }

    const body = await readJson(request)
    const result = await redeemCode(
      { id: session.user.id, role: session.user.role, name: session.user.name },
      body?.code
    )
    return NextResponse.json({ redeemed: true, ...result })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Redeem code error:", error)
    return NextResponse.json({ error: "Failed to redeem code" }, { status: 500 })
  }
}
