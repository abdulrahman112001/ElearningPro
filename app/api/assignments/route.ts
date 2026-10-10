import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { assignmentTargetStudentIds, canTargetHomework, teacherAssignmentScope } from "@/lib/school"
import { idOrNull, parseAssignmentFields } from "./_shared"

const DAY_MS = 24 * 60 * 60 * 1000

// GET /api/assignments?groupId=&courseId=&dueSoon=1 : the teacher's homework
export async function GET(request: Request) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const url = new URL(request.url)
    const groupId = url.searchParams.get("groupId")
    const courseId = url.searchParams.get("courseId")
    const dueSoon = url.searchParams.get("dueSoon") === "1"
    const now = new Date()

    const scope = await teacherAssignmentScope(session.user)
    const assignments = await db.assignment.findMany({
      where: {
        AND: [
          scope,
          groupId ? { groupId } : {},
          courseId ? { courseId } : {},
          dueSoon ? { dueAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) } } : {},
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      include: {
        group: { select: { id: true, name: true, _count: { select: { members: true } } } },
        course: { select: { id: true, titleAr: true, titleEn: true, _count: { select: { enrollments: true } } } },
        lesson: { select: { id: true, titleAr: true, titleEn: true } },
        teacher: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    })
    const ungraded = assignments.length
      ? await db.assignmentSubmission.groupBy({
          by: ["assignmentId"],
          where: { assignmentId: { in: assignments.map((a) => a.id) }, gradedAt: null },
          _count: { _all: true },
        })
      : []
    const ungradedMap = new Map(ungraded.map((u) => [u.assignmentId, u._count._all]))

    const rows = assignments.map((a) => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      dueAt: a.dueAt,
      maxScore: a.maxScore,
      allowLate: a.allowLate,
      createdAt: a.createdAt,
      teacher: a.teacher,
      group: a.group ? { id: a.group.id, name: a.group.name } : null,
      course: a.course ? { id: a.course.id, titleAr: a.course.titleAr, titleEn: a.course.titleEn } : null,
      lesson: a.lesson,
      targets: a.group ? a.group._count.members : a.course?._count.enrollments ?? 0,
      submissions: a._count.submissions,
      needsGrading: ungradedMap.get(a.id) ?? 0,
    }))
    return NextResponse.json({
      assignments: rows,
      summary: {
        total: rows.length,
        needsGrading: rows.reduce((s, r) => s + r.needsGrading, 0),
        dueSoon: rows.filter((r) => r.dueAt && r.dueAt >= now && r.dueAt.getTime() - now.getTime() <= 7 * DAY_MS).length,
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("List assignments error:", error)
    return NextResponse.json({ error: "Failed to load homework" }, { status: 500 })
  }
}

// POST /api/assignments { groupId | courseId (+lessonId), title, ... }
export async function POST(request: Request) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const body = await readJson(request)
    const groupId = idOrNull(body.groupId)
    const courseId = groupId ? null : idOrNull(body.courseId)
    const lessonId = courseId ? idOrNull(body.lessonId) : null
    if (!groupId && !courseId) {
      return NextResponse.json({ error: "Choose a group or a course", field: "target", code: "required" }, { status: 400 })
    }
    if (groupId && !(await db.classGroup.findUnique({ where: { id: groupId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }
    if (courseId && !(await db.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }
    if (!(await canTargetHomework(session.user, { groupId, courseId }))) {
      return NextResponse.json({ error: "You cannot give homework to this group or course" }, { status: 403 })
    }
    if (lessonId) {
      const lesson = await db.lesson.findFirst({ where: { id: lessonId, chapter: { courseId: courseId! } }, select: { id: true } })
      if (!lesson) return NextResponse.json({ error: "Lesson not found in this course", field: "lessonId" }, { status: 400 })
    }
    const fields = parseAssignmentFields(body, false)

    const assignment = await db.assignment.create({
      data: {
        ...(fields as Required<typeof fields>),
        teacherId: session.user.id,
        groupId,
        courseId,
        lessonId,
      },
    })

    const targets = await assignmentTargetStudentIds({ groupId, courseId })
    if (targets.length) {
      await db.notification.createMany({
        data: targets.map((userId) => ({
          userId,
          type: "SYSTEM" as const,
          title: `واجب جديد: ${assignment.title}`,
          message: assignment.dueAt
            ? `لديك واجب جديد "${assignment.title}" موعد تسليمه ${assignment.dueAt.toISOString().slice(0, 10)}`
            : `لديك واجب جديد "${assignment.title}"`,
          link: "/student/homework",
        })),
      })
    }
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "homework.created",
      entityType: "assignment",
      entityId: assignment.id,
      summary: `Created homework "${assignment.title}" for ${targets.length} students`,
      metadata: { groupId, courseId, lessonId, students: targets.length },
    })
    return NextResponse.json({ ...assignment, notified: targets.length }, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create assignment error:", error)
    return NextResponse.json({ error: "Failed to create homework" }, { status: 500 })
  }
}
