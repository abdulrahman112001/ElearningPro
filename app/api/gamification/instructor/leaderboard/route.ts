import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { canManageGroup } from "@/lib/organization"
import { courseStudentIds, groupStudentIds, rankUsers, weekStart, type LeaderboardPeriod } from "@/lib/gamification"

export const dynamic = "force-dynamic"

/**
 * Ranking of a teacher's students by points: ?groupId=... or ?courseId=...
 * plus &period=week|all. Only the teacher's own groups / courses (or admin).
 */
export async function GET(request: Request) {
  try {
    const guard = await requireInstructor()
    if (guard.error) return guard.error
    const user = guard.session.user

    const url = new URL(request.url)
    const groupId = url.searchParams.get("groupId")
    const courseId = url.searchParams.get("courseId")
    const period = (url.searchParams.get("period") ?? "week") as LeaderboardPeriod

    if (period !== "week" && period !== "all") {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 })
    }
    if (!groupId === !courseId) {
      return NextResponse.json({ error: "Pass exactly one of groupId or courseId" }, { status: 400 })
    }

    let ids: string[]
    if (groupId) {
      const group = await db.classGroup.findUnique({ where: { id: groupId }, select: { id: true } })
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })
      if (!(await canManageGroup(groupId, { id: user.id, role: user.role }))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      ids = await groupStudentIds(groupId)
    } else {
      const course = await db.course.findUnique({ where: { id: courseId! }, select: { instructorId: true } })
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
      if (course.instructorId !== user.id && user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      ids = await courseStudentIds(courseId!)
    }

    const entries = await rankUsers(ids, period)
    const total = entries.reduce((s, e) => s + e.points, 0)

    return NextResponse.json({
      period,
      weekStart: weekStart().toISOString(),
      entries,
      summary: {
        students: entries.length,
        totalPoints: total,
        averagePoints: entries.length ? Math.round(total / entries.length) : 0,
        active: entries.filter((e) => e.points > 0).length,
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Instructor leaderboard error:", error)
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 })
  }
}
