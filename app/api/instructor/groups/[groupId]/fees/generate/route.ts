import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireGroupManager } from "@/lib/attendance"
import { generateDues, PERIOD_RE } from "@/lib/fees"

// POST /api/instructor/groups/:id/fees/generate { period: "YYYY-MM", amount? }
// Creates a DUE fee for every member without one for that month, at the
// group's monthly fee (or `amount`). Safe to run again.
export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const { period, amount } = await readJson(request)
    if (typeof period !== "string" || !PERIOD_RE.test(period)) {
      return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 })
    }
    const group = await db.classGroup.findUniqueOrThrow({
      where: { id: params.groupId },
      select: { name: true, monthlyFee: true },
    })
    if (amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 100000)) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 })
    }
    const fee = Math.round((amount ?? group.monthlyFee) * 100) / 100
    if (!(fee > 0)) {
      return NextResponse.json({ error: "Set the group's monthly fee first", code: "no_monthly_fee" }, { status: 400 })
    }
    const result = await generateDues(params.groupId, period, fee)
    if (result.created > 0) {
      await logActivity({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "fee.generated",
        entityType: "classGroup",
        entityId: params.groupId,
        summary: `Generated ${result.created} dues of ${fee} EGP for ${period} in "${group.name}"`,
        metadata: { period, amount: fee, ...result },
      })
    }
    return NextResponse.json({ ...result, period, amount: fee })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Generate fees error:", error)
    return NextResponse.json({ error: "Failed to generate dues" }, { status: 500 })
  }
}
