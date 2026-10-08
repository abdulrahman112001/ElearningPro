import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"

/**
 * GET /api/instructor/results?courseId=&groupId=
 * Quiz results of the instructor's students: a ranking by average best score,
 * the top and the lowest performers, and per-quiz statistics.
 */
export async function GET(request: Request) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get("courseId")
    const groupId = searchParams.get("groupId")
    const instructorId = session.user.id

    const courseWhere = { instructorId, ...(courseId && { id: courseId }) }
    const quizzes = await db.quiz.findMany({
      where: { lesson: { chapter: { course: courseWhere } } },
      select: {
        id: true,
        title: true,
        titleAr: true,
        passingScore: true,
        lesson: {
          select: { chapter: { select: { course: { select: { id: true, titleAr: true, titleEn: true } } } } },
        },
      },
    })
    const quizIds = quizzes.map((q) => q.id)

    let memberIds: string[] | undefined
    if (groupId) {
      const group = await db.classGroup.findFirst({
        where: { id: groupId, instructorId },
        select: { members: { select: { studentId: true } } },
      })
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })
      memberIds = group.members.map((m) => m.studentId)
    }

    const attempts = await db.quizAttempt.findMany({
      where: {
        quizId: { in: quizIds },
        completedAt: { not: null },
        ...(memberIds && { userId: { in: memberIds } }),
      },
      select: {
        quizId: true,
        userId: true,
        score: true,
        passed: true,
        completedAt: true,
        user: { select: { id: true, name: true, email: true, image: true, guardianEmail: true } },
      },
    })

    // Best score per (student, quiz)
    const best = new Map<string, { score: number; passed: boolean }>()
    const students = new Map<string, (typeof attempts)[number]["user"] & { attempts: number; lastAttemptAt: Date | null }>()
    for (const a of attempts) {
      const key = `${a.userId}:${a.quizId}`
      const prev = best.get(key)
      if (!prev || a.score > prev.score) best.set(key, { score: a.score, passed: a.passed })
      const s = students.get(a.userId) ?? { ...a.user, attempts: 0, lastAttemptAt: null }
      s.attempts += 1
      if (!s.lastAttemptAt || (a.completedAt && a.completedAt > s.lastAttemptAt)) s.lastAttemptAt = a.completedAt
      students.set(a.userId, s)
    }

    const ranking = Array.from(students.values())
      .map((s) => {
        const scores = quizIds.map((q) => best.get(`${s.id}:${q}`)).filter(Boolean) as { score: number; passed: boolean }[]
        const average = scores.reduce((sum, x) => sum + x.score, 0) / (scores.length || 1)
        return {
          studentId: s.id,
          name: s.name,
          email: s.email,
          image: s.image,
          hasGuardianEmail: !!s.guardianEmail,
          averageScore: Math.round(average * 10) / 10,
          quizzesTaken: scores.length,
          quizzesPassed: scores.filter((x) => x.passed).length,
          totalQuizzes: quizIds.length,
          attempts: s.attempts,
          lastAttemptAt: s.lastAttemptAt,
        }
      })
      .sort((a, b) => b.averageScore - a.averageScore || b.quizzesPassed - a.quizzesPassed)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const quizStats = quizzes.map((q) => {
      const scores = Array.from(best.entries())
        .filter(([key]) => key.endsWith(`:${q.id}`))
        .map(([, v]) => v)
      return {
        quizId: q.id,
        title: q.titleAr || q.title,
        course: q.lesson.chapter.course,
        passingScore: q.passingScore,
        students: scores.length,
        averageScore: scores.length ? Math.round((scores.reduce((s, x) => s + x.score, 0) / scores.length) * 10) / 10 : null,
        passRate: scores.length ? Math.round((scores.filter((x) => x.passed).length / scores.length) * 100) : null,
      }
    })

    const TOP_N = 5
    return NextResponse.json({
      ranking,
      top: ranking.slice(0, TOP_N),
      // Lowest performers, worst first, never overlapping the top list.
      bottom: ranking.length > TOP_N ? ranking.slice(-Math.min(TOP_N, ranking.length - TOP_N)).reverse() : [],
      quizStats,
      summary: {
        students: ranking.length,
        averageScore: ranking.length
          ? Math.round((ranking.reduce((s, r) => s + r.averageScore, 0) / ranking.length) * 10) / 10
          : null,
        quizzes: quizIds.length,
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get results error:", error)
    return NextResponse.json({ error: "Failed to get results" }, { status: 500 })
  }
}
