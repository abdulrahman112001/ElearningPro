import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { getSecuritySettings } from "@/lib/video-protection"

export const dynamic = "force-dynamic"

const deviceSelect = {
  id: true,
  label: true,
  userAgent: true,
  ip: true,
  firstSeenAt: true,
  lastSeenAt: true,
  revokedAt: true,
} as const

/** A user's devices (active first) and the configured limit. */
export async function GET(_request: Request, { params }: { params: { userId: string } }) {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error

    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, email: true, phone: true, image: true, role: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const [devices, settings] = await Promise.all([
      db.userDevice.findMany({
        where: { userId: user.id },
        orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { lastSeenAt: "desc" }],
        select: deviceSelect,
      }),
      getSecuritySettings(),
    ])

    return NextResponse.json({
      user,
      devices,
      activeCount: devices.filter((d) => !d.revokedAt).length,
      maxDevices: settings.maxDevices,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin devices error:", error)
    return NextResponse.json({ error: "Failed to load devices" }, { status: 500 })
  }
}

/**
 * Revokes one device (`?deviceId=`) or all of the user's devices, freeing
 * slots so the user can sign in from a new device.
 */
export async function DELETE(request: Request, { params }: { params: { userId: string } }) {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error
    const { session } = guard

    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, email: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const deviceId = new URL(request.url).searchParams.get("deviceId")
    if (deviceId) {
      const device = await db.userDevice.findFirst({ where: { id: deviceId, userId: user.id } })
      if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const result = await db.userDevice.updateMany({
      where: { userId: user.id, revokedAt: null, ...(deviceId && { id: deviceId }) },
      data: { revokedAt: new Date() },
    })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "video.devices_reset",
      entityType: "user",
      entityId: user.id,
      summary: deviceId
        ? `Removed a device of ${user.name ?? user.email}`
        : `Reset all devices of ${user.name ?? user.email} (${result.count})`,
      metadata: { deviceId: deviceId ?? null, revoked: result.count },
    })

    await db.notification.create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: "تمت إعادة ضبط أجهزتك",
        message: "قام الدعم بإعادة ضبط الأجهزة المسجلة على حسابك، يمكنك الآن المشاهدة من جهازك الجديد.",
        link: "/student/devices",
      },
    })

    return NextResponse.json({ revoked: result.count })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin reset devices error:", error)
    return NextResponse.json({ error: "Failed to reset devices" }, { status: 500 })
  }
}
