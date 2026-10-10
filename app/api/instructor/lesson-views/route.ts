import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { allowedViews, getSecuritySettings } from "@/lib/video-protection"

export const dynamic = "force-dynamic"

/**
 * Students who used up the views allowed on one of the teacher's lessons
 * (admins see every course).
 */
export async function GET() {
  try {
    const guard = await requireInstructor()
    if (guard.error) return guard.error
    const { session } = guard

    const settings = await getSecuritySettings()
    const ownerFilter = session.user.role === "ADMIN" ? {} : { instructorId: session.user.id }

    // Only lessons that actually have a limit can be "reached".
    const limitFilter =
      settings.defaultMaxViews === null ? { maxViews: { not: null } } : {}

    const views = await db.lessonView.findMany({
      where: {
        count: { gt: 0 },
        lesson: { ...limitFilter, chapter: { course: ownerFilter } },
      },
      orderBy: { lastViewedAt: "desc" },
      take: 2000,
      select: {
        id: true,
        count: true,
        extraViews: true,
        lastViewedAt: true,
        user: { select: { id: true, name: true, email: true, image: true, phone: true } },
        lesson: {
          select: {
            id: true,
            titleEn: true,
            titleAr: true,
            maxViews: true,
            chapter: {
              select: { course: { select: { id: true, titleEn: true, titleAr: true, slug: true } } },
            },
          },
        },
      },
    })

    const rows = views
      .map((v) => {
        const allowed = allowedViews(v.lesson.maxViews, settings.defaultMaxViews, v.extraViews)
        return { v, allowed }
      })
      .filter(({ v, allowed }) => allowed !== null && v.count >= allowed)
      .map(({ v, allowed }) => ({
        id: v.id,
        viewsUsed: v.count,
        viewsAllowed: allowed as number,
        extraViews: v.extraViews,
        lastViewedAt: v.lastViewedAt,
        student: v.user,
        lesson: {
          id: v.lesson.id,
          titleEn: v.lesson.titleEn,
          titleAr: v.lesson.titleAr,
          maxViews: v.lesson.maxViews,
        },
        course: v.lesson.chapter.course,
      }))

    const limitedLessons = await db.lesson.count({
      where: {
        chapter: { course: ownerFilter },
        ...(settings.defaultMaxViews === null ? { maxViews: { not: null } } : {}),
      },
    })

    return NextResponse.json({
      rows,
      defaultMaxViews: settings.defaultMaxViews,
      stats: {
        blocked: rows.length,
        students: new Set(rows.map((r) => r.student.id)).size,
        limitedLessons,
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Lesson views error:", error)
    return NextResponse.json({ error: "Failed to load lesson views" }, { status: 500 })
  }
}
