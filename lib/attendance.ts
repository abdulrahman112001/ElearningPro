import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManageGroup } from "@/lib/organization"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { sendWhatsApp, normalizeEgyptianPhone } from "@/lib/whatsapp"

// ---------------------------------------------------------------------------
// Time zone: everything is stored in UTC and interpreted in Africa/Cairo.
// Egypt has observed DST in some years, so offsets are computed with Intl
// for the instant in question instead of being hard-coded.
// ---------------------------------------------------------------------------

export const CAIRO_TZ = "Africa/Cairo"
/** A student checking in more than this after the start is LATE. */
export const LATE_AFTER_MIN = 15
/** Lifetime of a check-in QR token; the page rotates it about every 30s. */
export const QR_TTL_MS = 45_000
export const QR_ROTATE_AFTER_MS = 30_000
/** Sessions marked cancelled keep their row (so generation skips them). */
export const CANCELLED_MODE = "CANCELLED"
export const SESSION_MODES = ["ONLINE", "OFFLINE"] as const
export const GROUP_MODES = ["ONLINE", "OFFLINE", "HYBRID"] as const
export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CAIRO_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
})
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export interface CairoParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  dayOfWeek: number // 0 = Sunday
}

/** Wall-clock parts of an instant in Cairo. */
export function cairoParts(date: Date): CairoParts {
  const p: Record<string, string> = {}
  for (const part of partsFmt.formatToParts(date)) p[part.type] = part.value
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    dayOfWeek: WEEKDAYS.indexOf(p.weekday),
  }
}

/** Cairo's offset from UTC in minutes at an instant (120 or 180). */
export function cairoOffsetMinutes(date: Date): number {
  const p = cairoParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

/** The UTC instant of a Cairo wall-clock time. */
export function cairoToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  let result = new Date(naive - cairoOffsetMinutes(new Date(naive)) * 60000)
  // Second pass: the offset at the real instant may differ around a DST switch.
  const corrected = new Date(naive - cairoOffsetMinutes(result) * 60000)
  if (corrected.getTime() !== result.getTime()) result = corrected
  return result
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "YYYY-MM-DD" of an instant in Cairo. */
export function cairoDateKey(date: Date): string {
  const p = cairoParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** "HH:mm" of an instant in Cairo. */
export function cairoTime(date: Date): string {
  const p = cairoParts(date)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** "YYYY-MM" of an instant in Cairo (fee period). */
export function cairoPeriod(date = new Date()): string {
  const p = cairoParts(date)
  return `${p.year}-${pad(p.month)}`
}

/** UTC bounds of the Cairo calendar day that contains `date`. */
export function cairoDayBounds(date = new Date()): { start: Date; end: Date } {
  const p = cairoParts(date)
  const start = cairoToUtc(p.year, p.month, p.day, 0, 0)
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1))
  const end = cairoToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0)
  return { start, end }
}

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
export const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses "YYYY-MM-DD" + "HH:mm" (Cairo) into a UTC Date, or null. */
export function parseCairoDateTime(date: unknown, time: unknown): Date | null {
  if (typeof date !== "string" || typeof time !== "string") return null
  const d = DATE_RE.exec(date)
  const t = TIME_RE.exec(time)
  if (!d || !t) return null
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])]
  const check = new Date(Date.UTC(y, m - 1, day))
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== day) return null
  return cairoToUtc(y, m, day, Number(t[1]), Number(t[2]))
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

type GroupGuard =
  | { session: Session; error?: undefined }
  | { session?: undefined; error: NextResponse }

/**
 * Signed-in user who may manage the group (its teacher, a manager of its
 * organization, or an admin). 404 when the group does not exist, 403 otherwise.
 */
export async function requireGroupManager(groupId: string): Promise<GroupGuard> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const pending = pendingInstructorResponse(session)
  if (pending) return { error: pending }
  const exists = await db.classGroup.findUnique({ where: { id: groupId }, select: { id: true } })
  if (!exists) return { error: NextResponse.json({ error: "Group not found" }, { status: 404 }) }
  if (!(await canManageGroup(groupId, session.user))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

/** Group ids the user manages: own groups plus groups of orgs they manage. Admins: all. */
export async function managedGroupWhere(user: { id: string; role?: string }) {
  if (user.role === "ADMIN") return {}
  const orgs = await db.organizationMember.findMany({
    where: { userId: user.id, role: { in: ["OWNER", "MANAGER"] } },
    select: { organizationId: true },
  })
  return {
    OR: [
      { instructorId: user.id },
      ...(orgs.length ? [{ organizationId: { in: orgs.map((o) => o.organizationId) } }] : []),
    ],
  }
}

/** The session if it belongs to the group, else null. */
export function findGroupSession(groupId: string, sessionId: string) {
  return db.groupSession.findFirst({ where: { id: sessionId, groupId } })
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Creates sessions from the weekly slots for the next `weeks` weeks, starting
 * today (Cairo). Sessions already in the past and times that already have a
 * session (including cancelled ones) are skipped.
 */
export async function generateSessions(groupId: string, weeks: number) {
  const group = await db.classGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { mode: true, location: true, scheduleSlots: true },
  })
  if (group.scheduleSlots.length === 0) return { created: 0, skipped: 0 }

  const now = new Date()
  const today = cairoParts(now)
  const candidates: { startsAt: Date; endsAt: Date; location: string | null }[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i))
    const dow = day.getUTCDay()
    for (const slot of group.scheduleSlots) {
      if (slot.dayOfWeek !== dow) continue
      const m = TIME_RE.exec(slot.startTime)
      if (!m) continue
      const startsAt = cairoToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Number(m[1]), Number(m[2]))
      if (startsAt <= now) continue
      candidates.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + slot.durationMin * 60000),
        location: slot.location ?? group.location,
      })
    }
  }
  if (candidates.length === 0) return { created: 0, skipped: 0 }

  const existing = await db.groupSession.findMany({
    where: { groupId, startsAt: { in: candidates.map((c) => c.startsAt) } },
    select: { startsAt: true },
  })
  const taken = new Set(existing.map((e) => e.startsAt.getTime()))
  const fresh = candidates.filter((c) => {
    if (taken.has(c.startsAt.getTime())) return false
    taken.add(c.startsAt.getTime())
    return true
  })
  if (fresh.length) {
    await db.groupSession.createMany({
      data: fresh.map((c) => ({
        groupId,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        mode: group.mode === "ONLINE" ? "ONLINE" : "OFFLINE",
        location: group.mode === "ONLINE" ? null : c.location,
      })),
    })
  }
  return { created: fresh.length, skipped: candidates.length - fresh.length }
}

/** Present/late/absent/excused counts per session id. */
export async function attendanceCounts(sessionIds: string[]) {
  const rows = sessionIds.length
    ? await db.attendanceRecord.groupBy({
        by: ["sessionId", "status"],
        where: { sessionId: { in: sessionIds } },
        _count: { _all: true },
      })
    : []
  const map = new Map<string, { PRESENT: number; LATE: number; ABSENT: number; EXCUSED: number }>()
  for (const id of sessionIds) map.set(id, { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 })
  for (const r of rows) map.get(r.sessionId)![r.status] = r._count._all
  return map
}

// ---------------------------------------------------------------------------
// QR check-in
// ---------------------------------------------------------------------------

export function newQrToken(): string {
  return randomBytes(18).toString("base64url")
}

/** Starts check-in or rotates the token of a session. */
export async function rotateQrToken(sessionId: string) {
  return db.groupSession.update({
    where: { id: sessionId },
    data: { qrToken: newQrToken(), qrExpiresAt: new Date(Date.now() + QR_TTL_MS) },
    select: { qrToken: true, qrExpiresAt: true },
  })
}

/** Absolute app origin for links in QR codes and messages. */
export function appOrigin(request?: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (env) return env.replace(/\/+$/, "")
  return request ? new URL(request.url).origin : ""
}

// ---------------------------------------------------------------------------
// Parents
// ---------------------------------------------------------------------------

/** Unique WhatsApp numbers of a student's linked parents and guardian. */
export async function parentPhones(studentId: string): Promise<{ phone: string; userId: string | null }[]> {
  const [student, links] = await Promise.all([
    db.user.findUnique({ where: { id: studentId }, select: { guardianPhone: true } }),
    db.parentLink.findMany({
      where: { studentId, status: "ACTIVE" },
      select: { parent: { select: { id: true, phone: true } } },
    }),
  ])
  const out = new Map<string, string | null>()
  for (const l of links) {
    const n = normalizeEgyptianPhone(l.parent.phone)
    if (n && !out.has(n)) out.set(n, l.parent.id)
  }
  const g = normalizeEgyptianPhone(student?.guardianPhone)
  if (g && !out.has(g)) out.set(g, null)
  return Array.from(out, ([phone, userId]) => ({ phone, userId }))
}

/**
 * Notifies absent students of a session (in-app) and their parents/guardian
 * (WhatsApp), once per record. Returns how many students were notified.
 */
export async function notifyAbsentees(sessionId: string): Promise<number> {
  const session = await db.groupSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { startsAt: true, group: { select: { name: true } } },
  })
  const records = await db.attendanceRecord.findMany({
    where: { sessionId, status: "ABSENT", parentNotified: false },
    select: { id: true, student: { select: { id: true, name: true } } },
  })
  const when = `${cairoDateKey(session.startsAt)} ${cairoTime(session.startsAt)}`
  for (const r of records) {
    // Claim the record first so concurrent closes never notify twice.
    const claimed = await db.attendanceRecord.updateMany({
      where: { id: r.id, parentNotified: false },
      data: { parentNotified: true },
    })
    if (claimed.count === 0) continue
    await db.notification.create({
      data: {
        userId: r.student.id,
        type: "SYSTEM",
        title: "تم تسجيل غيابك",
        message: `تم تسجيلك غائبًا عن حصة "${session.group.name}" بتاريخ ${when}.`,
        link: "/student/attendance",
      },
    })
    const text =
      `تنبيه غياب: الطالب/ة ${r.student.name ?? ""} لم يحضر حصة "${session.group.name}" بتاريخ ${when} (بتوقيت القاهرة).\n` +
      `Absence notice: ${r.student.name ?? "the student"} missed the "${session.group.name}" session on ${when} (Cairo time).`
    for (const p of await parentPhones(r.student.id)) {
      await sendWhatsApp({ to: p.phone, text, template: "absence", userId: p.userId })
    }
  }
  return records.length
}

// ---------------------------------------------------------------------------
// Schedule slots
// ---------------------------------------------------------------------------

/** Validates a slot body; returns the clean data or an error message. */
export function parseSlot(body: any, partial = false):
  | { data: { dayOfWeek?: number; startTime?: string; durationMin?: number; location?: string | null } }
  | { error: string } {
  const data: { dayOfWeek?: number; startTime?: string; durationMin?: number; location?: string | null } = {}
  if (body.dayOfWeek !== undefined || !partial) {
    if (!Number.isInteger(body.dayOfWeek) || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
      return { error: "dayOfWeek must be 0 (Sunday) to 6 (Saturday)" }
    }
    data.dayOfWeek = body.dayOfWeek
  }
  if (body.startTime !== undefined || !partial) {
    if (typeof body.startTime !== "string" || !TIME_RE.test(body.startTime)) {
      return { error: "startTime must be HH:mm" }
    }
    data.startTime = body.startTime
  }
  if (body.durationMin !== undefined) {
    if (!Number.isInteger(body.durationMin) || body.durationMin < 15 || body.durationMin > 600) {
      return { error: "durationMin must be between 15 and 600" }
    }
    data.durationMin = body.durationMin
  }
  if (body.location !== undefined) {
    if (body.location !== null && (typeof body.location !== "string" || body.location.length > 300)) {
      return { error: "Invalid location" }
    }
    data.location = body.location?.trim() || null
  }
  return { data }
}

// ---------------------------------------------------------------------------
// One-off sessions
// ---------------------------------------------------------------------------

export interface SessionInput {
  startsAt?: Date
  durationMin?: number
  title?: string | null
  mode?: "ONLINE" | "OFFLINE"
  location?: string | null
  notes?: string | null
}

/**
 * Validates a session body. The start is either `date` + `time` (Cairo wall
 * clock) or an ISO `startsAt`. With `partial` every field is optional.
 */
export function parseSessionBody(body: any, partial: boolean): { data: SessionInput } | { error: string } {
  const data: SessionInput = {}
  if (body.date !== undefined || body.time !== undefined) {
    const at = parseCairoDateTime(body.date, body.time)
    if (!at) return { error: "date must be YYYY-MM-DD and time HH:mm" }
    data.startsAt = at
  } else if (body.startsAt !== undefined) {
    const at = typeof body.startsAt === "string" ? new Date(body.startsAt) : null
    if (!at || Number.isNaN(at.getTime())) return { error: "startsAt must be an ISO date" }
    data.startsAt = at
  } else if (!partial) {
    return { error: "date and time are required" }
  }
  if (data.startsAt) {
    const year = data.startsAt.getUTCFullYear()
    if (year < 2020 || year > 2100) return { error: "Date out of range" }
  }
  if (body.durationMin !== undefined) {
    if (!Number.isInteger(body.durationMin) || body.durationMin < 15 || body.durationMin > 600) {
      return { error: "durationMin must be between 15 and 600" }
    }
    data.durationMin = body.durationMin
  }
  for (const [key, max] of [["title", 120], ["location", 300], ["notes", 1000]] as const) {
    const v = body[key]
    if (v === undefined) continue
    if (v !== null && (typeof v !== "string" || v.length > max)) return { error: `Invalid ${key}` }
    data[key] = v?.trim() || null
  }
  if (body.mode !== undefined) {
    if (!(SESSION_MODES as readonly string[]).includes(body.mode)) return { error: "mode must be ONLINE or OFFLINE" }
    data.mode = body.mode
  }
  return { data }
}

// ---------------------------------------------------------------------------
// Student and teacher overviews
// ---------------------------------------------------------------------------

/** Everything the student attendance page shows. */
export async function loadStudentAttendance(studentId: string) {
  const now = new Date()
  const memberships = await db.classGroupMember.findMany({
    where: { studentId },
    orderBy: { joinedAt: "desc" },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          mode: true,
          location: true,
          monthlyFee: true,
          instructor: { select: { id: true, name: true, image: true } },
        },
      },
    },
  })
  const groupIds = memberships.map((m) => m.group.id)
  const [records, upcoming, past, wallet, fees] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { studentId, session: { groupId: { in: groupIds } } },
      select: { sessionId: true, status: true, method: true, markedAt: true, session: { select: { groupId: true } } },
    }),
    db.groupSession.findMany({
      where: { groupId: { in: groupIds }, startsAt: { gte: now }, mode: { not: CANCELLED_MODE } },
      orderBy: { startsAt: "asc" },
      take: 60,
      select: { id: true, groupId: true, title: true, startsAt: true, endsAt: true, mode: true, location: true },
    }),
    db.groupSession.findMany({
      where: { groupId: { in: groupIds }, startsAt: { lt: now }, mode: { not: CANCELLED_MODE } },
      orderBy: { startsAt: "desc" },
      take: 200,
      select: { id: true, groupId: true, title: true, startsAt: true, mode: true },
    }),
    db.user.findUnique({ where: { id: studentId }, select: { walletBalance: true } }),
    db.groupFee.findMany({
      where: { studentId },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        period: true,
        amount: true,
        status: true,
        method: true,
        paidAt: true,
        receiptNo: true,
        note: true,
        group: { select: { id: true, name: true } },
      },
    }),
  ])
  const statusBySession = new Map(records.map((r) => [r.sessionId, r.status]))
  const groups = memberships.map(({ group }) => {
    const mine = records.filter((r) => r.session.groupId === group.id)
    const counted = mine.filter((r) => r.status !== "EXCUSED")
    const attended = counted.filter((r) => r.status === "PRESENT" || r.status === "LATE").length
    const tally = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 }
    for (const r of mine) tally[r.status]++
    return {
      group,
      rate: counted.length ? Math.round((attended / counted.length) * 100) : null,
      tally,
      recent: past
        .filter((s) => s.groupId === group.id)
        .slice(0, 8)
        .map((s) => ({ ...s, status: statusBySession.get(s.id) ?? null })),
      upcoming: upcoming.filter((s) => s.groupId === group.id).slice(0, 5),
    }
  })
  const outstanding = fees.filter((f) => f.status === "DUE").reduce((s, f) => s + f.amount, 0)
  return {
    groups,
    fees,
    walletBalance: wallet?.walletBalance ?? 0,
    outstanding: Math.round(outstanding * 100) / 100,
  }
}

/** Today's sessions and outstanding fees across the groups a user manages. */
export async function loadTeacherOverview(user: { id: string; role?: string }) {
  const where = await managedGroupWhere(user)
  const groups = await db.classGroup.findMany({
    where,
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, mode: true, monthlyFee: true, _count: { select: { members: true } } },
  })
  const groupIds = groups.map((g) => g.id)
  const { start, end } = cairoDayBounds()
  const now = new Date()
  const period = cairoPeriod()
  const [today, upcoming, dueByGroup, periodFees] = await Promise.all([
    db.groupSession.findMany({
      where: { groupId: { in: groupIds }, startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: "asc" },
      select: { id: true, groupId: true, title: true, startsAt: true, endsAt: true, mode: true, location: true, qrExpiresAt: true },
    }),
    db.groupSession.findMany({
      where: { groupId: { in: groupIds }, startsAt: { gte: end }, mode: { not: CANCELLED_MODE } },
      orderBy: { startsAt: "asc" },
      take: 8,
      select: { id: true, groupId: true, title: true, startsAt: true, mode: true, location: true },
    }),
    db.groupFee.groupBy({
      by: ["groupId"],
      where: { groupId: { in: groupIds }, status: "DUE" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.groupFee.groupBy({
      by: ["status"],
      where: { groupId: { in: groupIds }, period },
      _sum: { amount: true },
    }),
  ])
  const counts = await attendanceCounts(today.map((s) => s.id))
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const sum = (status: string) => periodFees.find((p) => p.status === status)?._sum.amount ?? 0
  return {
    period,
    groups: groups.map((g) => {
      const due = dueByGroup.find((d) => d.groupId === g.id)
      return {
        id: g.id,
        name: g.name,
        mode: g.mode,
        members: g._count.members,
        outstanding: due?._sum.amount ?? 0,
        dueCount: due?._count._all ?? 0,
      }
    }),
    today: today.map((s) => ({
      ...s,
      cancelled: s.mode === CANCELLED_MODE,
      checkinActive: !!s.qrExpiresAt && s.qrExpiresAt > now,
      group: { id: s.groupId, name: groupById.get(s.groupId)?.name ?? "", members: groupById.get(s.groupId)?._count.members ?? 0 },
      counts: counts.get(s.id)!,
    })),
    upcoming: upcoming.map((s) => ({ ...s, group: { id: s.groupId, name: groupById.get(s.groupId)?.name ?? "" } })),
    fees: {
      outstanding: dueByGroup.reduce((s, d) => s + (d._sum.amount ?? 0), 0),
      dueCount: dueByGroup.reduce((s, d) => s + d._count._all, 0),
      collectedThisPeriod: sum("PAID"),
      outstandingThisPeriod: sum("DUE"),
    },
  }
}
