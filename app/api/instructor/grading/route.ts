import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { requireInstructor } from "@/lib/instructor-guard"
import { apiErrorResponse } from "@/lib/api-error"

/**
 * GET /api/instructor/grading?status=pending|graded|all&courseId=
 * Completed attempts on the teacher's courses (admins: all courses).
 * pending = essay answers waiting for a score; graded = essays already
 * scored; all = every submitted attempt (to review tab switches).
 */
export async function GET(request: Request) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const isAdmin = g.session.user.role === "ADMIN"

    const sp = new URL(request.url).searchParams
    const status = sp.get("status") ?? "pending"
    const courseId = sp.get("courseId") || undefined
    const take = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "100") || 100))

    const courseFilter: Prisma.CourseWhereInput = {
      ...(isAdmin ? {} : { instructorId: g.session.user.id }),
      ...(courseId ? { id: courseId } : {}),
    }
    const base: Prisma.QuizAttemptWhereInput = {
      completedAt: { not: null },
      quiz: { lesson: { chapter: { course: courseFilter } } },
    }
    const where: Prisma.QuizAttemptWhereInput =
      status === "graded"
        ? { ...base, needsGrading: false, answers: { some: { gradedById: { not: null } } } }
        : status === "all"
          ? base
          : { ...base, needsGrading: true }

    const [attempts, pending] = await Promise.all([
      db.quizAttempt.findMany({
        where,
        orderBy: { completedAt: status === "pending" ? "asc" : "desc" },
        take,
        select: {
          id: true,
          score: true,
          passed: true,
          needsGrading: true,
          completedAt: true,
          timeSpent: true,
          tabSwitches: true,
          attemptNumber: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          quiz: {
            select: {
              id: true,
              title: true,
              titleAr: true,
              passingScore: true,
              lesson: {
                select: {
                  id: true,
                  titleEn: true,
                  titleAr: true,
                  chapter: { select: { course: { select: { id: true, titleEn: true, titleAr: true, slug: true } } } },
                },
              },
            },
          },
          answers: {
            where: { question: { type: "ESSAY" } },
            select: { gradedAt: true },
          },
        },
      }),
      db.quizAttempt.count({ where: { ...base, needsGrading: true } }),
    ])

    return NextResponse.json({
      pending,
      attempts: attempts.map(({ answers, ...a }) => ({
        ...a,
        essayCount: answers.length,
        ungradedCount: answers.filter((x) => x.gradedAt === null).length,
      })),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Grading inbox error:", error)
    return NextResponse.json({ error: "Failed to load attempts" }, { status: 500 })
  }
}
