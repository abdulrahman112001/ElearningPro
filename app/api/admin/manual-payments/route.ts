import { NextResponse } from "next/server"
import type { ManualPaymentStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"

export const dynamic = "force-dynamic"

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const

// GET /api/admin/manual-payments?status=PENDING
// Transfer requests, each with a warning when the same method + reference was
// already approved for another request.
export async function GET(request: Request) {
  try {
    const g = await requireAdmin()
    if (g.error) return g.error
    const raw = new URL(request.url).searchParams.get("status") ?? "PENDING"
    const status = (STATUSES as readonly string[]).includes(raw) ? (raw as ManualPaymentStatus) : "PENDING"

    const [payments, counts] = await Promise.all([
      db.manualPayment.findMany({
        where: { status },
        orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
        take: 200,
        include: {
          user: { select: { id: true, name: true, email: true, image: true, phone: true, walletBalance: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
      db.manualPayment.groupBy({ by: ["status"], _count: true }),
    ])

    const approvedSame = payments.length
      ? await db.manualPayment.findMany({
          where: {
            status: "APPROVED",
            OR: payments.map((p) => ({ method: p.method, reference: p.reference })),
          },
          select: { id: true, method: true, reference: true, userId: true, amount: true, reviewedAt: true },
        })
      : []
    const withWarnings = payments.map((p) => {
      const dup = approvedSame.find((a) => a.id !== p.id && a.method === p.method && a.reference === p.reference)
      return { ...p, duplicateOf: dup ?? null }
    })

    return NextResponse.json({
      payments: withWarnings,
      counts: Object.fromEntries(STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count ?? 0])),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin manual payments error:", error)
    return NextResponse.json({ error: "Failed to load transfers" }, { status: 500 })
  }
}
