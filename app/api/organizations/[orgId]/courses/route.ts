import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { requireOrg, serverError } from "../../_lib"

type Params = { params: { orgId: string } }

const COURSE_SELECT = {
  id: true, titleAr: true, titleEn: true, slug: true, thumbnail: true, status: true,
  price: true, currency: true, organizationId: true, instructorId: true,
  instructor: { select: { id: true, name: true } },
} as const

// GET /api/organizations/[orgId]/courses: org courses + the caller's attachable courses
export async function GET(_request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ["OWNER", "MANAGER", "TEACHER"])
    if (guard.error) return guard.error
    const [courses, mine] = await Promise.all([
      db.course.findMany({
        where: { organizationId: params.orgId },
        orderBy: { createdAt: "desc" },
        select: COURSE_SELECT,
      }),
      db.course.findMany({
        where: { instructorId: guard.session.user.id, organizationId: null, status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        select: COURSE_SELECT,
      }),
    ])
    return NextResponse.json({ courses, attachable: mine })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("List org courses error:", error, "Failed to load courses")
  }
}

// POST /api/organizations/[orgId]/courses { courseId }: a teacher attaches their own course
export async function POST(request: Request, { params }: Params) {
  try {
    const guard = await requireOrg(params.orgId, ["OWNER", "MANAGER", "TEACHER"], { write: true })
    if (guard.error) return guard.error
    const { courseId } = await readJson(request)
    if (typeof courseId !== "string" || !courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, titleEn: true, titleAr: true, instructorId: true, organizationId: true },
    })
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
    if (course.instructorId !== guard.session.user.id) {
      return NextResponse.json(
        { error: "Only the course's own teacher can attach it", code: "not_course_owner" },
        { status: 403 }
      )
    }
    if (course.organizationId === params.orgId) return NextResponse.json({ ok: true })
    if (course.organizationId) {
      return NextResponse.json(
        { error: "This course already belongs to another organization", code: "course_in_other_org" },
        { status: 409 }
      )
    }
    await db.course.update({ where: { id: course.id }, data: { organizationId: params.orgId } })
    await logActivity({
      actorId: guard.session.user.id,
      actorRole: guard.session.user.role,
      action: "organization.course_attached",
      entityType: "course",
      entityId: course.id,
      summary: `Attached "${course.titleAr || course.titleEn}" to "${guard.org.name}"`,
      metadata: { organizationId: params.orgId },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Attach org course error:", error, "Failed to attach course")
  }
}
