import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"

/** httpOnly cookie that identifies the browser/device. */
export const DEVICE_COOKIE = "did"
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2 // two years

/** Re-opening a lesson within this window does not count as a new view. */
export const VIEW_WINDOW_MS = 2 * 60 * 60 * 1000

export const SETTING_MAX_DEVICES = "security.maxDevices"
export const SETTING_DEFAULT_MAX_VIEWS = "security.defaultMaxViews"
export const DEFAULT_MAX_DEVICES = 2

export const MAX_VIEWS_LIMIT = 100
export const MAX_DEVICES_LIMIT = 20
export const MAX_GRANT = 50

export interface SecuritySettings {
  /** 0 = unlimited */
  maxDevices: number
  /** null = unlimited (used when Lesson.maxViews is null) */
  defaultMaxViews: number | null
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: [SETTING_MAX_DEVICES, SETTING_DEFAULT_MAX_VIEWS] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  let maxDevices = DEFAULT_MAX_DEVICES
  const rawDevices = map[SETTING_MAX_DEVICES]
  if (rawDevices !== undefined && rawDevices.trim() !== "") {
    const n = Number(rawDevices)
    if (Number.isInteger(n) && n >= 0) maxDevices = n
  }

  let defaultMaxViews: number | null = null
  const rawViews = map[SETTING_DEFAULT_MAX_VIEWS]
  if (rawViews !== undefined && rawViews.trim() !== "") {
    const n = Number(rawViews)
    if (Number.isInteger(n) && n >= 1) defaultMaxViews = n
  }

  return { maxDevices, defaultMaxViews }
}

/**
 * Validates a "max views" input: undefined = not sent, null/"" = unlimited,
 * otherwise an integer 1..100. Throws a 400 ApiError for anything else.
 */
export function parseMaxViews(value: unknown, field = "maxViews"): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  const n = typeof value === "string" ? Number(value) : value
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_VIEWS_LIMIT) {
    throw new ApiError(400, `${field} must be an integer between 1 and ${MAX_VIEWS_LIMIT}, or null`, {
      code: "invalid_max_views",
      field,
    })
  }
  return n
}

export function newDeviceId() {
  return randomBytes(16).toString("hex")
}

export function isValidDeviceId(value: string | undefined | null): value is string {
  return !!value && /^[a-f0-9]{32}$/.test(value)
}

/** "Chrome on Windows" style label from a user agent. */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  const ua = userAgent || ""
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null
  if (browser && os) return `${browser} · ${os}`
  return browser || os || null
}

/** "ah***@gmail.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return ""
  const [local, domain] = email.split("@")
  if (!domain) return email.slice(0, 2) + "***"
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

/** Watermark text: the viewer's name + phone (or masked email). */
export function watermarkText(user: { name?: string | null; phone?: string | null; email?: string | null }) {
  const contact = user.phone?.trim() || maskEmail(user.email)
  return [user.name?.trim(), contact].filter(Boolean).join(" · ")
}

export type DeviceCheck =
  | { ok: true }
  | {
      ok: false
      devices: { id: string; label: string | null; lastSeenAt: Date; firstSeenAt: Date }[]
    }

/**
 * Records the device for the user. A device that is new (or was revoked) is
 * refused when the user already has `maxDevices` active devices.
 */
export async function registerDevice(input: {
  userId: string
  deviceId: string
  userAgent: string | null
  ip: string | null
  maxDevices: number
}): Promise<DeviceCheck> {
  const { userId, deviceId, userAgent, ip, maxDevices } = input
  const now = new Date()
  const existing = await db.userDevice.findUnique({
    where: { userId_deviceId: { userId, deviceId } },
  })

  if (existing && !existing.revokedAt) {
    await db.userDevice.update({
      where: { id: existing.id },
      data: { lastSeenAt: now, userAgent, ip, label: deviceLabel(userAgent) },
    })
    return { ok: true }
  }

  if (maxDevices > 0) {
    const active = await db.userDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, label: true, lastSeenAt: true, firstSeenAt: true },
    })
    if (active.length >= maxDevices) return { ok: false, devices: active }
  }

  await db.userDevice.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    update: { revokedAt: null, firstSeenAt: now, lastSeenAt: now, userAgent, ip, label: deviceLabel(userAgent) },
    create: { userId, deviceId, userAgent, ip, label: deviceLabel(userAgent) },
  })
  return { ok: true }
}

/** Views a student may use on a lesson, or null when unlimited. */
export function allowedViews(
  lessonMaxViews: number | null | undefined,
  defaultMaxViews: number | null,
  extraViews: number
): number | null {
  const base = lessonMaxViews ?? defaultMaxViews
  return base == null ? null : base + extraViews
}
