import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse, readJson } from "@/lib/api-error"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { logActivity } from "@/lib/activity"
import { MANUAL_PAYMENT_METHODS, MAX_TOPUP, MIN_TOPUP, normalizeReference } from "@/lib/payment-settings"

export const dynamic = "force-dynamic"

// GET: own transfer requests.
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const payments = await db.manualPayment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    return NextResponse.json({ payments })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("List manual payments error:", error)
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 })
  }
}

// POST { method, amount, reference, senderPhone?, note? }: report a transfer
// for an admin to approve into the wallet.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const limited = rateLimit({ scope: "manual-payment", identifier: session.user.id, limit: 10, windowMs: 60 * 60 * 1000 })
    if (!limited.success) return tooManyRequests(limited.resetAt)

    const body = await readJson(request)
    const fields: { field: string; code: string }[] = []
    const method = body?.method
    if (typeof method !== "string" || !(MANUAL_PAYMENT_METHODS as readonly string[]).includes(method)) {
      fields.push({ field: "method", code: "invalid" })
    }
    const amount = Number(body?.amount)
    if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) fields.push({ field: "amount", code: "out_of_range" })
    const reference = typeof body?.reference === "string" ? normalizeReference(body.reference) : ""
    if (reference.length < 4 || reference.length > 64) fields.push({ field: "reference", code: "invalid" })
    let senderPhone: string | null = null
    if (body?.senderPhone !== undefined && body?.senderPhone !== null && body?.senderPhone !== "") {
      const phone = typeof body.senderPhone === "string" ? body.senderPhone.replace(/[\s\-()]/g, "") : ""
      if (!/^\+?\d{8,15}$/.test(phone)) fields.push({ field: "senderPhone", code: "invalid" })
      else senderPhone = phone
    } else if (method === "VODAFONE_CASH") {
      fields.push({ field: "senderPhone", code: "required" })
    }
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) || null : null
    if (fields.length) return NextResponse.json({ error: "Invalid input", fields }, { status: 400 })

    // The same receipt cannot be reported twice by the same account.
    const dup = await db.manualPayment.findFirst({
      where: { userId: session.user.id, method, reference, status: { in: ["PENDING", "APPROVED"] } },
      select: { id: true },
    })
    if (dup) {
      return NextResponse.json({ error: "You already reported this transfer", code: "duplicate_reference" }, { status: 409 })
    }

    const payment = await db.manualPayment.create({
      data: {
        userId: session.user.id,
        method,
        amount: Math.round(amount * 100) / 100,
        reference,
        senderPhone,
        note,
      },
    })

    const admins = await db.user.findMany({ where: { role: "ADMIN", isBlocked: false }, select: { id: true } })
    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "SYSTEM" as const,
          title: "New transfer to review",
          message: `${session.user.name ?? "A user"} reported a ${method} transfer of ${payment.amount} EGP.`,
          link: "/admin/manual-payments",
        })),
      })
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "payment.manual_submitted",
      entityType: "manualPayment",
      entityId: payment.id,
      summary: `Reported ${method} transfer of ${payment.amount} EGP (ref ${reference})`,
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create manual payment error:", error)
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }
}
