import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { listManageableGroups } from "@/lib/school"

// GET /api/assignments/options : groups and courses the teacher can give homework to
export async function GET() {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const [groups, courses] = await Promise.all([
      listManageableGroups(session.user),
      db.course.findMany({
        where: session.user.role === "ADMIN" ? {} : { instructorId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          titleAr: true,
          titleEn: true,
          chapters: {
            orderBy: { position: "asc" },
            select: { lessons: { orderBy: { position: "asc" }, select: { id: true, titleAr: true, titleEn: true } } },
          },
        },
      }),
    ])
    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        organization: g.organization,
        members: g._count.members,
      })),
      courses: courses.map((c) => ({
        id: c.id,
        titleAr: c.titleAr,
        titleEn: c.titleEn,
        lessons: c.chapters.flatMap((ch) => ch.lessons),
      })),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Assignment options error:", error)
    return NextResponse.json({ error: "Failed to load options" }, { status: 500 })
  }
}
