import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-error"
import { isAiConfigured } from "@/lib/ai/client"
import { getDailyUsage } from "@/lib/ai/guard"

/** GET /api/ai/status : whether AI is enabled and the caller's usage today. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const usage = await getDailyUsage(session.user.id)
    return NextResponse.json({ configured: isAiConfigured(), ...usage })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("AI status error:", error)
    return NextResponse.json({ error: "Failed to get AI status" }, { status: 500 })
  }
}
