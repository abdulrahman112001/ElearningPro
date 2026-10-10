import { randomInt } from "crypto"
import type { AccessCodeType, Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"
import { creditWallet } from "@/lib/wallet"
import { logActivity } from "@/lib/activity"
import { activateTeacherSubscriptionInTx, logSubscriptionActivated } from "@/lib/teacher-subscription"
import { SUBSCRIPTION_DAYS } from "@/lib/access"

/** No 0/O/1/I so codes read aloud or scratched off a card stay unambiguous. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const CODE_LENGTH = 12
export const MAX_BATCH_QUANTITY = 1000
export const MAX_SUBSCRIPTION_MONTHS = 24
export const MAX_WALLET_CODE_VALUE = 20000

export const CODE_TYPES = ["COURSE", "SUBSCRIPTION", "WALLET"] as const

/** XXXX-XXXX-XXXX from a cryptographically secure source. */
export function generateCode(): string {
  let raw = ""
  for (let i = 0; i < CODE_LENGTH; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return formatCode(raw)
}

export function formatCode(raw: string): string {
  return raw.match(/.{1,4}/g)!.join("-")
}

/**
 * Normalizes what a student types: uppercase, no spaces/dashes. Returns the
 * stored form (XXXX-XXXX-XXXX) or null when it cannot be a valid code.
 */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null
  const raw = input.toUpperCase().replace(/[\s\-_–—.]/g, "")
  if (raw.length !== CODE_LENGTH) return null
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null
  return formatCode(raw)
}

export type CodeActor = { id: string; role: string }

export interface CreateBatchInput {
  name?: unknown
  type?: unknown
  courseId?: unknown
  instructorId?: unknown
  months?: unknown
  value?: unknown
  quantity?: unknown
  expiresAt?: unknown
}

const fieldError = (field: string, code: string) =>
  new ApiError(400, `Invalid ${field}`, { code, field })

/**
 * Validates and creates a batch with `quantity` unique codes. Teachers may
 * only create COURSE codes for their own courses and SUBSCRIPTION codes for
 * their own subscription; admins may create anything, including WALLET.
 */
export async function createCodeBatch(actor: CodeActor, input: CreateBatchInput) {
  const isAdmin = actor.role === "ADMIN"
  const type = input.type
  if (typeof type !== "string" || !(CODE_TYPES as readonly string[]).includes(type)) {
    throw fieldError("type", "invalid_type")
  }
  const quantity = Number(input.quantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BATCH_QUANTITY) {
    throw fieldError("quantity", "invalid_quantity")
  }
  let expiresAt: Date | null = null
  if (input.expiresAt !== undefined && input.expiresAt !== null && input.expiresAt !== "") {
    const d = new Date(String(input.expiresAt))
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) throw fieldError("expiresAt", "invalid_expiry")
    expiresAt = d
  }
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : ""

  let instructorId: string | null = null
  let courseId: string | null = null
  let months = 1
  let value = 0
  let defaultName = ""

  if (type === "COURSE") {
    if (typeof input.courseId !== "string" || !input.courseId) throw fieldError("courseId", "course_required")
    const course = await db.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, instructorId: true, titleAr: true, titleEn: true },
    })
    if (!course) throw new ApiError(404, "Course not found", { code: "course_not_found" })
    if (!isAdmin && course.instructorId !== actor.id) {
      throw new ApiError(403, "You can only create codes for your own courses", { code: "not_your_course" })
    }
    courseId = course.id
    instructorId = course.instructorId
    defaultName = course.titleAr || course.titleEn
  } else if (type === "SUBSCRIPTION") {
    months = Number(input.months ?? 1)
    if (!Number.isInteger(months) || months < 1 || months > MAX_SUBSCRIPTION_MONTHS) {
      throw fieldError("months", "invalid_months")
    }
    const target = isAdmin && typeof input.instructorId === "string" && input.instructorId ? input.instructorId : actor.id
    if (!isAdmin && input.instructorId && input.instructorId !== actor.id) {
      throw new ApiError(403, "You can only create codes for your own subscription", { code: "not_your_subscription" })
    }
    const instructor = await db.user.findFirst({
      where: { id: target, role: "INSTRUCTOR" },
      select: { id: true, name: true },
    })
    if (!instructor) throw new ApiError(404, "Instructor not found", { code: "instructor_not_found" })
    instructorId = instructor.id
    defaultName = `${instructor.name ?? ""} · ${months}m`.trim()
  } else {
    if (!isAdmin) throw new ApiError(403, "Only admins can create wallet codes", { code: "wallet_admin_only" })
    value = Number(input.value)
    if (!Number.isFinite(value) || value <= 0 || value > MAX_WALLET_CODE_VALUE) throw fieldError("value", "invalid_value")
    value = Math.round(value * 100) / 100
    defaultName = `${value} EGP`
  }

  const batch = await db.$transaction(
    async (tx) => {
      const created = await tx.accessCodeBatch.create({
        data: {
          name: name || defaultName || type,
          type: type as AccessCodeType,
          createdById: actor.id,
          instructorId,
          courseId,
          months,
          value,
          quantity,
          expiresAt,
        },
      })
      // Insert, skipping collisions with existing codes, until we have them all.
      let inserted = 0
      for (let attempt = 0; inserted < quantity && attempt < 20; attempt++) {
        const want = quantity - inserted
        const set = new Set<string>()
        while (set.size < want) set.add(generateCode())
        const res = await tx.accessCode.createMany({
          data: Array.from(set, (code) => ({ code, batchId: created.id })),
          skipDuplicates: true,
        })
        inserted += res.count
      }
      if (inserted < quantity) throw new Error("Could not generate unique codes")
      return created
    },
    { timeout: 30_000 }
  )

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    action: "code.batch_created",
    entityType: "accessCodeBatch",
    entityId: batch.id,
    summary: `Created ${quantity} ${type} code(s): ${batch.name}`,
    metadata: { type, quantity, courseId, instructorId, months, value },
  })
  return batch
}

/** Which batches an actor may see and manage. */
export function batchScope(actor: CodeActor): Prisma.AccessCodeBatchWhereInput {
  if (actor.role === "ADMIN") return {}
  return { OR: [{ createdById: actor.id }, { instructorId: actor.id }] }
}

const batchInclude = {
  course: { select: { id: true, titleAr: true, titleEn: true, slug: true } },
  instructor: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, role: true } },
} satisfies Prisma.AccessCodeBatchInclude

export async function listBatches(actor: CodeActor, opts: { type?: string | null; q?: string | null } = {}) {
  const where: Prisma.AccessCodeBatchWhereInput = { AND: [batchScope(actor)] }
  if (opts.type && (CODE_TYPES as readonly string[]).includes(opts.type)) {
    ;(where.AND as Prisma.AccessCodeBatchWhereInput[]).push({ type: opts.type as AccessCodeType })
  }
  if (opts.q) {
    ;(where.AND as Prisma.AccessCodeBatchWhereInput[]).push({ name: { contains: opts.q, mode: "insensitive" } })
  }
  const batches = await db.accessCodeBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: batchInclude,
  })
  const ids = batches.map((b) => b.id)
  const [used, disabled] = await Promise.all([
    db.accessCode.groupBy({ by: ["batchId"], where: { batchId: { in: ids }, redeemedById: { not: null } }, _count: true }),
    db.accessCode.groupBy({ by: ["batchId"], where: { batchId: { in: ids }, disabled: true, redeemedById: null }, _count: true }),
  ])
  const usedMap = new Map(used.map((u) => [u.batchId, u._count]))
  const disabledMap = new Map(disabled.map((u) => [u.batchId, u._count]))
  return batches.map((b) => ({
    ...b,
    used: usedMap.get(b.id) ?? 0,
    disabledCount: disabledMap.get(b.id) ?? 0,
    expired: !!b.expiresAt && b.expiresAt.getTime() <= Date.now(),
  }))
}

/** A batch the actor may manage (404 otherwise, so ids do not leak). */
export async function getBatchFor(actor: CodeActor, batchId: string) {
  const batch = await db.accessCodeBatch.findFirst({
    where: { AND: [{ id: batchId }, batchScope(actor)] },
    include: batchInclude,
  })
  if (!batch) throw new ApiError(404, "Batch not found")
  return batch
}

export async function getBatchDetail(actor: CodeActor, batchId: string) {
  const batch = await getBatchFor(actor, batchId)
  const codes = await db.accessCode.findMany({
    where: { batchId },
    orderBy: { code: "asc" },
    include: { redeemedBy: { select: { id: true, name: true, email: true } } },
  })
  const expired = !!batch.expiresAt && batch.expiresAt.getTime() <= Date.now()
  return {
    ...batch,
    expired,
    used: codes.filter((c) => c.redeemedById).length,
    codes: codes.map((c) => ({ ...c, status: codeStatus(c, expired) })),
  }
}

export function codeStatus(c: { redeemedById: string | null; disabled: boolean }, expired: boolean) {
  if (c.redeemedById) return "REDEEMED" as const
  if (c.disabled) return "DISABLED" as const
  if (expired) return "EXPIRED" as const
  return "AVAILABLE" as const
}

/** Disables every unused code of a batch. */
export async function disableBatch(actor: CodeActor, batchId: string) {
  const batch = await getBatchFor(actor, batchId)
  const res = await db.accessCode.updateMany({
    where: { batchId, redeemedById: null, disabled: false },
    data: { disabled: true },
  })
  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    action: "code.disabled",
    entityType: "accessCodeBatch",
    entityId: batch.id,
    summary: `Disabled ${res.count} unused code(s) in batch ${batch.name}`,
    metadata: { count: res.count },
  })
  return { disabled: res.count }
}

/** Enables or disables one unused code. */
export async function setCodeDisabled(actor: CodeActor, batchId: string, codeId: string, disabled: boolean) {
  const batch = await getBatchFor(actor, batchId)
  const code = await db.accessCode.findFirst({ where: { id: codeId, batchId } })
  if (!code) throw new ApiError(404, "Code not found")
  if (code.redeemedById) throw new ApiError(409, "This code was already used", { code: "already_used" })
  const updated = await db.accessCode.update({ where: { id: code.id }, data: { disabled } })
  if (disabled) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      action: "code.disabled",
      entityType: "accessCode",
      entityId: code.id,
      summary: `Disabled code ${code.code} (${batch.name})`,
      metadata: { batchId },
    })
  }
  return updated
}

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v)
  // Defuse spreadsheet formulas.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function batchCsv(actor: CodeActor, batchId: string) {
  const batch = await getBatchDetail(actor, batchId)
  const header = ["code", "status", "type", "course", "teacher", "months", "value_egp", "expires_at", "redeemed_by", "redeemed_email", "redeemed_at"]
  const rows = batch.codes.map((c) => [
    c.code,
    c.status,
    batch.type,
    batch.course ? batch.course.titleAr || batch.course.titleEn : "",
    batch.instructor?.name ?? "",
    batch.type === "SUBSCRIPTION" ? batch.months : "",
    batch.type === "WALLET" ? batch.value : "",
    batch.expiresAt ? batch.expiresAt.toISOString() : "",
    c.redeemedBy?.name ?? "",
    c.redeemedBy?.email ?? "",
    c.redeemedAt ? c.redeemedAt.toISOString() : "",
  ])
  // BOM so Excel opens Arabic text as UTF-8.
  const body = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
  const safeName = batch.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "codes"
  return { body, filename: `codes-${safeName}-${batch.id.slice(-6)}.csv` }
}

// ---------------------------------------------------------------------------
// Redemption
// ---------------------------------------------------------------------------

const redeemError = (status: number, code: string, message: string) => new ApiError(status, message, { code })

/**
 * Redeems a code for a student. The claim is atomic (a conditional update on
 * an unused, enabled code) and runs in the same transaction as its effect,
 * so a failed effect releases the code and concurrent attempts get exactly one
 * winner.
 */
export async function redeemCode(user: { id: string; role: string; name?: string | null }, rawCode: unknown) {
  const normalized = normalizeCode(rawCode)
  if (!normalized) throw redeemError(400, "invalid", "Invalid code")

  const record = await db.accessCode.findUnique({
    where: { code: normalized },
    include: {
      batch: {
        include: {
          course: { select: { id: true, titleAr: true, titleEn: true, slug: true, instructorId: true } },
          instructor: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!record) throw redeemError(404, "invalid", "Invalid code")
  if (record.redeemedById) throw redeemError(409, "already_used", "This code was already used")
  if (record.disabled) throw redeemError(410, "disabled", "This code has been disabled")
  const batch = record.batch
  if (batch.expiresAt && batch.expiresAt.getTime() <= Date.now()) throw redeemError(410, "expired", "This code has expired")
  if (batch.type === "COURSE" && !batch.course) throw redeemError(410, "disabled", "This code is no longer valid")
  if (batch.type === "SUBSCRIPTION" && !batch.instructorId) throw redeemError(410, "disabled", "This code is no longer valid")
  if (batch.instructorId && batch.instructorId === user.id) throw redeemError(400, "own_code", "You cannot redeem your own code")

  const now = new Date()
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.accessCode.updateMany({
      where: { id: record.id, redeemedById: null, disabled: false },
      data: { redeemedById: user.id, redeemedAt: now },
    })
    if (claimed.count === 0) {
      const fresh = await tx.accessCode.findUnique({ where: { id: record.id }, select: { disabled: true, redeemedById: true } })
      if (fresh?.redeemedById) throw redeemError(409, "already_used", "This code was already used")
      throw redeemError(410, "disabled", "This code has been disabled")
    }

    if (batch.type === "COURSE") {
      const course = batch.course!
      const enrollment = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      })
      if (enrollment && !enrollment.viaSubscription) {
        throw redeemError(409, "already_enrolled", "You are already enrolled in this course")
      }
      await tx.purchase.create({
        data: {
          userId: user.id,
          courseId: course.id,
          amount: 0,
          currency: "EGP",
          provider: "CODE",
          providerId: record.id,
          status: "COMPLETED",
        },
      })
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        update: { viaSubscription: false },
        create: { userId: user.id, courseId: course.id },
      })
      await tx.notification.create({
        data: {
          userId: course.instructorId,
          type: "NEW_ENROLLMENT",
          title: "Code redeemed",
          message: `${user.name ?? "A student"} enrolled in "${course.titleAr || course.titleEn}" with an access code.`,
          link: `/instructor/codes/${batch.id}`,
        },
      })
      return { type: "COURSE" as const, course }
    }

    if (batch.type === "SUBSCRIPTION") {
      const subscription = await activateTeacherSubscriptionInTx(tx, {
        studentId: user.id,
        instructorId: batch.instructorId!,
        amount: 0,
        provider: "CODE",
        providerId: record.id,
        days: batch.months * SUBSCRIPTION_DAYS,
      })
      return { type: "SUBSCRIPTION" as const, subscription, months: batch.months }
    }

    const walletTx = await creditWallet(
      { userId: user.id, amount: batch.value, reason: "code_redeemed", reference: record.id, note: record.code },
      tx
    )
    return { type: "WALLET" as const, amount: batch.value, balance: walletTx.balanceAfter }
  })

  // Student notification
  const studentMessage =
    result.type === "COURSE"
      ? `You are now enrolled in "${result.course.titleAr || result.course.titleEn}".`
      : result.type === "SUBSCRIPTION"
        ? `Your subscription to ${batch.instructor?.name ?? "the teacher"} is active until ${result.subscription.endsAt?.toISOString().slice(0, 10)}.`
        : `${result.amount} EGP were added to your wallet.`
  await db.notification
    .create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: "Code redeemed",
        message: studentMessage,
        link:
          result.type === "COURSE"
            ? `/courses/${result.course.slug}`
            : result.type === "SUBSCRIPTION"
              ? "/student/subscriptions"
              : "/student/wallet",
      },
    })
    .catch(() => {})

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "code.redeemed",
    entityType: "accessCode",
    entityId: record.id,
    summary: `Redeemed ${batch.type} code ${record.code}`,
    metadata: { batchId: batch.id, courseId: batch.courseId, instructorId: batch.instructorId, value: batch.value, months: batch.months },
  })
  if (result.type === "SUBSCRIPTION") {
    await logSubscriptionActivated(
      { studentId: user.id, instructorId: batch.instructorId!, amount: 0, provider: "CODE" },
      result.subscription
    )
  }

  if (result.type === "COURSE") {
    return { type: result.type, course: result.course }
  }
  if (result.type === "SUBSCRIPTION") {
    return {
      type: result.type,
      months: result.months,
      endsAt: result.subscription.endsAt,
      instructor: batch.instructor,
    }
  }
  return { type: result.type, amount: result.amount, balance: result.balance }
}

// ---------------------------------------------------------------------------
// Brute-force guard for redemption. Same fixed-window idea as lib/rate-limit,
// but kept on globalThis so dev hot reloads do not reset the counters.
// (Per instance; back it with a shared store on multi-instance deployments.)
// ---------------------------------------------------------------------------
const redeemBuckets: Map<string, { count: number; resetAt: number }> = ((
  globalThis as unknown as { __codeRedeemBuckets?: Map<string, { count: number; resetAt: number }> }
).__codeRedeemBuckets ??= new Map())

/** Counts one attempt; returns resetAt when the caller is over the limit. */
export function hitRedeemLimit(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now()
  if (redeemBuckets.size > 10_000) {
    redeemBuckets.forEach((v, k) => v.resetAt <= now && redeemBuckets.delete(k))
  }
  const state = redeemBuckets.get(key)
  if (!state || state.resetAt <= now) {
    redeemBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (state.count >= limit) return state.resetAt
  state.count += 1
  return null
}
