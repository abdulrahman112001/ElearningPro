import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { BADGES, ensureBadges, levelFromPoints, weeklyPoints } from "@/lib/gamification"

export const dynamic = "force-dynamic"

/** The signed-in user's points, level, streak, badges and recent history. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    await ensureBadges()
    const [user, badges, owned, history, weekly] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { points: true, currentStreak: true, longestStreak: true, lastActiveDate: true },
      }),
      db.badge.findMany({ where: { key: { in: BADGES.map((b) => b.key) } } }),
      db.userBadge.findMany({ where: { userId }, select: { badgeId: true, awardedAt: true } }),
      db.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, points: true, reason: true, createdAt: true },
      }),
      weeklyPoints([userId]),
    ])
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const awarded = new Map(owned.map((o) => [o.badgeId, o.awardedAt]))
    const order = new Map(BADGES.map((b, i) => [b.key, i]))

    return NextResponse.json({
      points: user.points,
      weeklyPoints: weekly.get(userId) ?? 0,
      level: levelFromPoints(user.points),
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      lastActiveDate: user.lastActiveDate,
      badges: badges
        .sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99))
        .map((b) => ({
          key: b.key,
          nameAr: b.nameAr,
          nameEn: b.nameEn,
          descriptionAr: b.descriptionAr,
          descriptionEn: b.descriptionEn,
          icon: b.icon,
          earned: awarded.has(b.id),
          awardedAt: awarded.get(b.id) ?? null,
        })),
      history,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Gamification me error:", error)
    return NextResponse.json({ error: "Failed to load achievements" }, { status: 500 })
  }
}
