import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import {
  MAX_DEVICES_LIMIT,
  SETTING_DEFAULT_MAX_VIEWS,
  SETTING_MAX_DEVICES,
  getSecuritySettings,
  parseMaxViews,
} from "@/lib/video-protection"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error
    const [settings, activeDevices, usersWithDevices] = await Promise.all([
      getSecuritySettings(),
      db.userDevice.count({ where: { revokedAt: null } }),
      db.userDevice.groupBy({ by: ["userId"], where: { revokedAt: null } }).then((r) => r.length),
    ])
    return NextResponse.json({ ...settings, stats: { activeDevices, usersWithDevices } })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Security settings error:", error)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

/**
 * { maxDevices: 0..20 (0 = unlimited), defaultMaxViews: 1..100 | null }.
 * Either field may be omitted.
 */
export async function PUT(request: Request) {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error
    const { session } = guard

    const body = await readJson(request)
    const { maxDevices } = body ?? {}
    if (
      maxDevices !== undefined &&
      (typeof maxDevices !== "number" || !Number.isInteger(maxDevices) || maxDevices < 0 || maxDevices > MAX_DEVICES_LIMIT)
    ) {
      return NextResponse.json(
        { error: `maxDevices must be an integer between 0 and ${MAX_DEVICES_LIMIT}`, code: "invalid_max_devices", field: "maxDevices" },
        { status: 400 }
      )
    }
    const defaultMaxViews = parseMaxViews(body?.defaultMaxViews, "defaultMaxViews")

    const before = await getSecuritySettings()
    const writes = []
    if (maxDevices !== undefined) {
      writes.push(
        db.setting.upsert({
          where: { key: SETTING_MAX_DEVICES },
          update: { value: String(maxDevices) },
          create: { key: SETTING_MAX_DEVICES, value: String(maxDevices) },
        })
      )
    }
    if (defaultMaxViews !== undefined) {
      const value = defaultMaxViews === null ? "" : String(defaultMaxViews)
      writes.push(
        db.setting.upsert({
          where: { key: SETTING_DEFAULT_MAX_VIEWS },
          update: { value },
          create: { key: SETTING_DEFAULT_MAX_VIEWS, value },
        })
      )
    }
    if (writes.length) await db.$transaction(writes)

    const after = await getSecuritySettings()
    if (after.maxDevices !== before.maxDevices || after.defaultMaxViews !== before.defaultMaxViews) {
      await logActivity({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "video.settings_updated",
        entityType: "setting",
        summary: `Video protection: max devices ${after.maxDevices || "unlimited"}, default max views ${after.defaultMaxViews ?? "unlimited"}`,
        metadata: { before: { ...before }, after: { ...after } },
      })
    }

    return NextResponse.json(after)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update security settings error:", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
