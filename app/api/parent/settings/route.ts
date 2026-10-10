import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { normalizeEgyptianPhone } from "@/lib/whatsapp"
import { getReportOptOuts, reportOptOutKey, requireParent } from "@/lib/reports/parent-links"

async function load(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, phone: true, preferredLanguage: true },
  })
  const off = await getReportOptOuts([userId])
  return {
    ...user,
    whatsappReports: !off.has(reportOptOutKey("whatsapp", userId)),
    emailReports: !off.has(reportOptOutKey("email", userId)),
  }
}

export async function GET() {
  try {
    const guard = await requireParent()
    if (guard.error) return guard.error
    return NextResponse.json(await load(guard.session.user.id))
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent settings error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/** Updates name, phone, report language and the weekly-report channels. */
export async function PATCH(request: Request) {
  try {
    const guard = await requireParent()
    if (guard.error) return guard.error
    const userId = guard.session.user.id
    const body = await readJson(request)

    const data: { name?: string; phone?: string | null; preferredLanguage?: string } = {}
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 100) {
        return NextResponse.json({ error: "Invalid name", field: "name" }, { status: 400 })
      }
      data.name = body.name.trim()
    }
    if (body.phone !== undefined) {
      const phone = typeof body.phone === "string" ? body.phone.trim() : ""
      if (phone && (phone.length > 30 || !normalizeEgyptianPhone(phone))) {
        return NextResponse.json({ error: "Invalid phone", code: "invalid_phone", field: "phone" }, { status: 400 })
      }
      data.phone = phone || null
    }
    if (body.preferredLanguage !== undefined) {
      if (body.preferredLanguage !== "ar" && body.preferredLanguage !== "en") {
        return NextResponse.json({ error: "Invalid language", field: "preferredLanguage" }, { status: 400 })
      }
      data.preferredLanguage = body.preferredLanguage
    }
    for (const [field, channel] of [
      ["whatsappReports", "whatsapp"],
      ["emailReports", "email"],
    ] as const) {
      if (body[field] !== undefined && typeof body[field] !== "boolean") {
        return NextResponse.json({ error: `Invalid ${field}`, field }, { status: 400 })
      }
      if (typeof body[field] === "boolean") {
        const key = reportOptOutKey(channel, userId)
        if (body[field]) await db.setting.deleteMany({ where: { key } })
        else await db.setting.upsert({ where: { key }, create: { key, value: "1" }, update: { value: "1" } })
      }
    }

    if (Object.keys(data).length) await db.user.update({ where: { id: userId }, data })
    await logActivity({
      actorId: userId,
      actorRole: guard.session.user.role,
      action: "parent.settings_updated",
      entityType: "user",
      entityId: userId,
      summary: `${guard.session.user.name ?? "Parent"} updated report settings`,
    })
    return NextResponse.json(await load(userId))
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Parent settings update error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
