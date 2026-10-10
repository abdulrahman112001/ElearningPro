import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { canManageGroup } from "@/lib/organization"
import {
  courseStudentIds,
  groupStudentIds,
  platformLeaderboard,
  rankUsers,
  weekStart,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "@/lib/gamification"

export const dynamic = "force-dynamic"

/**
 * Student leaderboard: ?scope=platform|group|course&id=...&period=week|all.
 * Group and course boards only for their members / enrolled students.
 * Never returns emails: names and avatars only.
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user

    const url = new URL(request.url)
    const scope = url.searchParams.get("scope") ?? "platform"
    const period = (url.searchParams.get("period") ?? "week") as LeaderboardPeriod
    const id = url.searchParams.get("id")

    if (!["platform", "group", "course"].includes(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
    }
    if (period !== "week" && period !== "all") {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 })
    }

    // Boards this user can open
    const [memberships, enrollments] = await Promise.all([
      db.classGroupMember.findMany({
        where: { studentId: user.id },
        select: { group: { select: { id: true, name: true } } },
        orderBy: { joinedAt: "desc" },
      }),
      db.enrollment.findMany({
        where: { userId: user.id },
        select: { course: { select: { id: true, titleAr: true, titleEn: true } } },
        orderBy: { enrolledAt: "desc" },
      }),
    ])
    const options = {
      groups: memberships.map((m) => m.group),
      courses: enrollments.map((e) => e.course),
    }

    let entries: LeaderboardEntry[]
    let me: LeaderboardEntry | null = null
    if (scope === "platform") {
      const board = await platformLeaderboard(period, user.id)
      entries = board.entries
      me = board.me
    } else {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      let ids: string[]
      if (scope === "group") {
        const allowed =
          options.groups.some((g) => g.id === id) ||
          (await canManageGroup(id, { id: user.id, role: user.role }))
        if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        ids = await groupStudentIds(id)
      } else {
        let allowed = options.courses.some((c) => c.id === id) || user.role === "ADMIN"
        if (!allowed) {
          const course = await db.course.findUnique({ where: { id }, select: { instructorId: true } })
          allowed = course?.instructorId === user.id
        }
        if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        ids = await courseStudentIds(id)
      }
      entries = await rankUsers(ids, period)
      me = entries.find((e) => e.userId === user.id) ?? null
    }

    return NextResponse.json({
      scope,
      period,
      weekStart: weekStart().toISOString(),
      entries: entries.map((e) => ({ ...e, isMe: e.userId === user.id })),
      me,
      options,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Leaderboard error:", error)
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 })
  }
}
