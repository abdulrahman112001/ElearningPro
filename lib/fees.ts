import { randomBytes } from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { cairoPeriod } from "@/lib/attendance"
import { canManageGroup } from "@/lib/organization"

type Tx = Prisma.TransactionClient

export const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
/** One reminder batch per group per this window. */
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000

const RECEIPT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** "RC-YYYYMM-XXXXX" using the Cairo month of the payment. */
export function newReceiptNo(at = new Date()): string {
  const bytes = randomBytes(5)
  let code = ""
  for (let i = 0; i < bytes.length; i++) code += RECEIPT_ALPHABET[bytes[i] % RECEIPT_ALPHABET.length]
  return `RC-${cairoPeriod(at).replace("-", "")}-${code}`
}

/**
 * Runs `fn` with a fresh receipt number, retrying when it collides with an
 * existing one (unique constraint on GroupFee.receiptNo).
 */
export async function withReceiptNo<T>(fn: (receiptNo: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(newReceiptNo())
    } catch (e) {
      const collision =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        String((e.meta as { target?: unknown })?.target ?? "").includes("receiptNo")
      if (!collision || attempt >= 4) throw e
    }
  }
}

/** Creates DUE fees for every member of the group that has none for the period. */
export async function generateDues(groupId: string, period: string, amount: number) {
  const members = await db.classGroupMember.findMany({ where: { groupId }, select: { studentId: true } })
  if (members.length === 0 || !(amount > 0)) return { created: 0, total: members.length }
  const { count } = await db.groupFee.createMany({
    data: members.map((m) => ({ groupId, studentId: m.studentId, period, amount })),
    skipDuplicates: true,
  })
  return { created: count, total: members.length }
}

/** Due / collected / outstanding totals for a set of fees. */
export function feeSummary(fees: { amount: number; status: string }[]) {
  let collected = 0
  let outstanding = 0
  let waived = 0
  let paidCount = 0
  let dueCount = 0
  for (const f of fees) {
    if (f.status === "PAID") {
      collected += f.amount
      paidCount++
    } else if (f.status === "DUE") {
      outstanding += f.amount
      dueCount++
    } else waived += f.amount
  }
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    due: r(collected + outstanding),
    collected: r(collected),
    outstanding: r(outstanding),
    waived: r(waived),
    paidCount,
    dueCount,
    count: fees.length,
  }
}

/** Marks a DUE fee as PAID inside a transaction; false when it was not DUE anymore. */
export async function markFeePaid(
  tx: Tx,
  feeId: string,
  data: { method: string; receiptNo: string; recordedById: string | null; note?: string | null }
) {
  const { count } = await tx.groupFee.updateMany({
    where: { id: feeId, status: "DUE" },
    data: {
      status: "PAID",
      method: data.method,
      receiptNo: data.receiptNo,
      paidAt: new Date(),
      recordedById: data.recordedById,
      ...(data.note !== undefined && { note: data.note }),
    },
  })
  return count === 1
}

/**
 * Who may reverse a recorded payment or waiver: platform admins, the owner of
 * the group's organization, or the teacher of a group outside any organization.
 */
export async function canUndoFee(groupId: string, user: { id: string; role?: string }): Promise<boolean> {
  if (user.role === "ADMIN") return true
  const group = await db.classGroup.findUnique({
    where: { id: groupId },
    select: { instructorId: true, organizationId: true, organization: { select: { ownerId: true } } },
  })
  if (!group) return false
  if (!group.organizationId) return group.instructorId === user.id
  if (group.organization?.ownerId === user.id) return true
  const m = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: group.organizationId, userId: user.id } },
    select: { role: true },
  })
  return m?.role === "OWNER"
}

/** When reminders were last sent for the group, from the activity log. */
export async function lastReminderAt(groupId: string): Promise<Date | null> {
  const last = await db.activityLog.findFirst({
    where: { action: "fee.reminders_sent", entityType: "classGroup", entityId: groupId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  return last?.createdAt ?? null
}

/** Fee with everything a receipt shows, if the user may see it (student or group manager). */
export async function loadReceipt(feeId: string, user: { id: string; role?: string }) {
  const fee = await db.groupFee.findUnique({
    where: { id: feeId },
    include: {
      student: { select: { id: true, name: true, email: true } },
      recordedBy: { select: { id: true, name: true } },
      group: {
        select: {
          id: true,
          name: true,
          location: true,
          instructor: { select: { name: true } },
          organization: { select: { name: true, phone: true, address: true, logoUrl: true } },
        },
      },
    },
  })
  if (!fee) return null
  if (fee.studentId !== user.id && !(await canManageGroup(fee.groupId, user))) return null
  return fee
}
