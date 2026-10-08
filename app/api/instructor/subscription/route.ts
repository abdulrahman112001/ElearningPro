import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"

async function requireInstructor() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

// GET /api/instructor/subscription: the instructor's own subscription settings
export async function GET() {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const userId = session!.user.id
    const [profile, activeSubscribers] = await Promise.all([
      db.instructorProfile.findUnique({
        where: { userId },
        select: { subscriptionEnabled: true, monthlyPrice: true },
      }),
      db.teacherSubscription.count({
        where: { instructorId: userId, status: "ACTIVE", endsAt: { gt: new Date() } },
      }),
    ])
    return NextResponse.json({
      enabled: profile?.subscriptionEnabled ?? false,
      monthlyPrice: profile?.monthlyPrice ?? 0,
      activeSubscribers,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get subscription settings error:", error)
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 })
  }
}

// PATCH /api/instructor/subscription { enabled?, monthlyPrice? }
export async function PATCH(request: Request) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const { enabled, monthlyPrice } = await readJson(request)
    if (enabled !== undefined && typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 })
    }
    if (
      monthlyPrice !== undefined &&
      (typeof monthlyPrice !== "number" || !Number.isFinite(monthlyPrice) || monthlyPrice < 0 || monthlyPrice > 100000)
    ) {
      return NextResponse.json({ error: "monthlyPrice must be between 0 and 100000" }, { status: 400 })
    }
    const data = {
      ...(enabled !== undefined && { subscriptionEnabled: enabled }),
      ...(monthlyPrice !== undefined && { monthlyPrice }),
    }
    const profile = await db.instructorProfile.upsert({
      where: { userId: session!.user.id },
      update: data,
      create: { userId: session!.user.id, ...data },
      select: { subscriptionEnabled: true, monthlyPrice: true },
    })
    return NextResponse.json({ enabled: profile.subscriptionEnabled, monthlyPrice: profile.monthlyPrice })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update subscription settings error:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
