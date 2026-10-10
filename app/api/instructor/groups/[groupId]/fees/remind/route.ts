import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { rateLimit } from "@/lib/rate-limit"
import { sendWhatsApp, normalizeEgyptianPhone } from "@/lib/whatsapp"
import { parentPhones, requireGroupManager } from "@/lib/attendance"
import { lastReminderAt, REMINDER_WINDOW_MS } from "@/lib/fees"

// POST /api/instructor/groups/:id/fees/remind
// WhatsApp reminder to every student with DUE fees in the group and to their
// parents/guardian. Allowed once per group per 24 hours.
export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error

    const last = await lastReminderAt(params.groupId)
    const burst = rateLimit({ scope: "fee-reminders", identifier: params.groupId, limit: 1, windowMs: 10_000 })
    if (!burst.success || (last && last.getTime() + REMINDER_WINDOW_MS > Date.now())) {
      const retryAt = last ? new Date(last.getTime() + REMINDER_WINDOW_MS) : new Date(burst.resetAt)
      return NextResponse.json(
        { error: "Reminders were already sent in the last 24 hours", code: "rate_limited", retryAt },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((retryAt.getTime() - Date.now()) / 1000))) } }
      )
    }

    const group = await db.classGroup.findUniqueOrThrow({ where: { id: params.groupId }, select: { name: true } })
    const due = await db.groupFee.findMany({
      where: { groupId: params.groupId, status: "DUE" },
      orderBy: { period: "asc" },
      select: { studentId: true, period: true, amount: true, student: { select: { name: true, phone: true } } },
    })
    const byStudent = new Map<string, typeof due>()
    for (const f of due) byStudent.set(f.studentId, [...(byStudent.get(f.studentId) ?? []), f])

    let students = 0
    let messages = 0
    for (const [studentId, fees] of Array.from(byStudent)) {
      students++
      const total = Math.round(fees.reduce((s, f) => s + f.amount, 0) * 100) / 100
      const months = fees.map((f) => f.period).join(", ")
      const name = fees[0].student.name ?? ""
      const text =
        `تذكير بالمصروفات: على الطالب/ة ${name} مبلغ ${total} جنيه لمجموعة "${group.name}" عن شهر (${months}). يمكن الدفع نقدًا أو من المحفظة في المنصة.\n` +
        `Fee reminder: ${name} has ${total} EGP due for "${group.name}" (${months}). Pay in cash or from the wallet on the platform.`
      const targets = await parentPhones(studentId)
      const own = normalizeEgyptianPhone(fees[0].student.phone)
      if (own && !targets.some((t) => t.phone === own)) targets.unshift({ phone: own, userId: studentId })
      for (const t of targets) {
        await sendWhatsApp({ to: t.phone, text, template: "fee_due", userId: t.userId })
        messages++
      }
      await db.notification.create({
        data: {
          userId: studentId,
          type: "SYSTEM",
          title: "تذكير بالمصروفات",
          message: `عليك ${total} جنيه لمجموعة "${group.name}" (${months}).`,
          link: "/student/attendance",
        },
      })
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "fee.reminders_sent",
      entityType: "classGroup",
      entityId: params.groupId,
      summary: `Sent fee reminders to ${students} students in "${group.name}" (${messages} WhatsApp messages)`,
      metadata: { students, messages },
    })
    return NextResponse.json({ students, messages })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Fee reminders error:", error)
    return NextResponse.json({ error: "Failed to send reminders" }, { status: 500 })
  }
}
