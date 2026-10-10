import { NextResponse } from "next/server"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"
import { getPaymentSettings, savePaymentSettings } from "@/lib/payment-settings"
import { logActivity } from "@/lib/activity"

export const dynamic = "force-dynamic"

// GET / PUT the accounts students transfer to (Vodafone Cash, InstaPay, bank).
export async function GET() {
  try {
    const g = await requireAdmin()
    if (g.error) return g.error
    return NextResponse.json(await getPaymentSettings())
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get payment settings error:", error)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const g = await requireAdmin()
    if (g.error) return g.error
    const body = await readJson(request)
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    const saved = await savePaymentSettings(body)
    await logActivity({
      actorId: g.session.user.id,
      actorRole: g.session.user.role,
      action: "settings.payments_updated",
      entityType: "setting",
      summary: "Updated manual payment receiving accounts",
    })
    return NextResponse.json(saved)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Save payment settings error:", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
