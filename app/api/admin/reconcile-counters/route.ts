import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { reconcileCounters } from "@/lib/reconcile-counters"

// Recomputes denormalized counters (Course.totalStudents/averageRating/
// totalReviews, InstructorProfile earnings, Coupon.usedCount) from their
// source-of-truth tables. Callable by an authenticated admin (POST, e.g. a
// "Reconcile now" admin button), or by Vercel Cron (GET, see vercel.json)
// presenting CRON_SECRET.
async function handle(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const diffs = await reconcileCounters()

  return NextResponse.json({
    correctedCount: diffs.length,
    diffs,
  })
}

export async function GET(request: Request) {
  try {
    return await handle(request)
  } catch (error) {
    console.error("Reconcile counters error:", error)
    return NextResponse.json(
      { error: "Failed to reconcile counters" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    return await handle(request)
  } catch (error) {
    console.error("Reconcile counters error:", error)
    return NextResponse.json(
      { error: "Failed to reconcile counters" },
      { status: 500 }
    )
  }
}
