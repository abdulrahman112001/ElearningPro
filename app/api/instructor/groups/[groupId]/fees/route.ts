import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { cairoPeriod, requireGroupManager } from "@/lib/attendance"
import { canUndoFee, feeSummary, lastReminderAt, PERIOD_RE, REMINDER_WINDOW_MS } from "@/lib/fees"

// GET /api/instructor/groups/:id/fees?period=YYYY-MM
// Fees of the month with summary cards, plus members still without a fee.
export async function GET(request: Request, { params }: { params: { groupId: string } }) {
  try {
    const { session, error } = await requireGroupManager(params.groupId)
    if (error) return error
    const period = new URL(request.url).searchParams.get("period") || cairoPeriod()
    if (!PERIOD_RE.test(period)) return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 })

    const [group, fees, members, canUndo, lastReminder, allOutstanding] = await Promise.all([
      db.classGroup.findUniqueOrThrow({
        where: { id: params.groupId },
        select: { id: true, name: true, monthlyFee: true, organizationId: true },
      }),
      db.groupFee.findMany({
        where: { groupId: params.groupId, period },
        orderBy: { createdAt: "asc" },
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          recordedBy: { select: { id: true, name: true } },
        },
      }),
      db.classGroupMember.findMany({ where: { groupId: params.groupId }, select: { studentId: true } }),
      canUndoFee(params.groupId, session.user),
      lastReminderAt(params.groupId),
      db.groupFee.aggregate({
        where: { groupId: params.groupId, status: "DUE" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])
    const withFee = new Set(fees.map((f) => f.studentId))
    const nextReminderAt =
      lastReminder && lastReminder.getTime() + REMINDER_WINDOW_MS > Date.now()
        ? new Date(lastReminder.getTime() + REMINDER_WINDOW_MS)
        : null
    return NextResponse.json({
      group,
      period,
      fees,
      summary: feeSummary(fees),
      missing: members.filter((m) => !withFee.has(m.studentId)).length,
      outstandingAllTime: { amount: allOutstanding._sum.amount ?? 0, count: allOutstanding._count._all },
      canUndo,
      lastReminderAt: lastReminder,
      nextReminderAt,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("List fees error:", error)
    return NextResponse.json({ error: "Failed to load fees" }, { status: 500 })
  }
}
