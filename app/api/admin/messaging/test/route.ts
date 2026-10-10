import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/instructor-guard"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { normalizeEgyptianPhone, sendWhatsApp } from "@/lib/whatsapp"

/** Sends a test WhatsApp message: {to, text?} */
export async function POST(request: Request) {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error
    const body = await readJson(request)
    if (typeof body.to !== "string" || !normalizeEgyptianPhone(body.to)) {
      return NextResponse.json({ error: "Invalid phone", code: "invalid_phone" }, { status: 400 })
    }
    if (body.text !== undefined && (typeof body.text !== "string" || body.text.length > 1000)) {
      return NextResponse.json({ error: "Invalid text" }, { status: 400 })
    }
    const text = body.text?.trim() || "رسالة تجريبية من المنصة / Test message from the platform"
    const result = await sendWhatsApp({ to: body.to, text, template: "test", userId: null })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "messaging.test_sent",
      entityType: "system",
      summary: `Test WhatsApp to ${normalizeEgyptianPhone(body.to)}: ${result.status}`,
      metadata: { status: result.status },
    })
    return NextResponse.json(result)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin test WhatsApp error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
