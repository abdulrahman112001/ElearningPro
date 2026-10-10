import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { assignmentTargetStudentIds, canManageAssignment, isAssignmentTarget } from "@/lib/school"
import { parseAssignmentFields } from "../_shared"

type Params = { params: { id: string } }

const include = {
  group: { select: { id: true, name: true } },
  course: { select: { id: true, titleAr: true, titleEn: true, slug: true } },
  lesson: { select: { id: true, titleAr: true, titleEn: true } },
  teacher: { select: { id: true, name: true, image: true } },
} as const

/**
 * GET /api/assignments/:id
 * Teachers who manage it get every target student with their submission.
 * A target student gets the assignment and their own submission. Anyone
 * else gets 404.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const assignment = await db.assignment.findUnique({ where: { id: params.id }, include })
    if (!assignment) return NextResponse.json({ error: "Homework not found" }, { status: 404 })

    const manager =
      (session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN") &&
      !pendingInstructorResponse(session) &&
      (await canManageAssignment(session.user, assignment))

    if (manager) {
      const targetIds = await assignmentTargetStudentIds(assignment)
      const [students, submissions] = await Promise.all([
        db.user.findMany({
          where: { id: { in: targetIds } },
          select: { id: true, name: true, email: true, image: true },
          orderBy: { name: "asc" },
        }),
        db.assignmentSubmission.findMany({ where: { assignmentId: assignment.id } }),
      ])
      const byStudent = new Map(submissions.map((s) => [s.studentId, s]))
      // Students who left the group but had submitted still show up.
      const extraIds = submissions.map((s) => s.studentId).filter((id) => !targetIds.includes(id))
      const extra = extraIds.length
        ? await db.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true, email: true, image: true } })
        : []
      const rows = [...students, ...extra].map((st) => ({ student: st, submission: byStudent.get(st.id) ?? null }))
      return NextResponse.json({
        role: "teacher",
        assignment,
        rows,
        summary: {
          targets: targetIds.length,
          submitted: submissions.length,
          graded: submissions.filter((s) => s.gradedAt).length,
          late: submissions.filter((s) => s.isLate).length,
        },
      })
    }

    if (!(await isAssignmentTarget(assignment, session.user.id))) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 })
    }
    const submission = await db.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: session.user.id } },
    })
    return NextResponse.json({ role: "student", assignment, submission })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get assignment error:", error)
    return NextResponse.json({ error: "Failed to load homework" }, { status: 500 })
  }
}

async function loadManaged(id: string) {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  const pending = pendingInstructorResponse(session)
  if (pending) return { error: pending }
  const assignment = await db.assignment.findUnique({ where: { id } })
  if (!assignment) return { error: NextResponse.json({ error: "Homework not found" }, { status: 404 }) }
  if (!(await canManageAssignment(session.user, assignment))) {
    return { error: NextResponse.json({ error: "You cannot manage this homework" }, { status: 403 }) }
  }
  return { session, assignment }
}

// PATCH /api/assignments/:id { title?, description?, subject?, dueAt?, maxScore?, allowLate?, attachmentUrl? }
export async function PATCH(request: Request, { params }: Params) {
  try {
    const r = await loadManaged(params.id)
    if (r.error) return r.error
    const { session, assignment } = r
    const fields = parseAssignmentFields(await readJson(request), true)
    if (fields.maxScore !== undefined && fields.maxScore < assignment.maxScore) {
      const above = await db.assignmentSubmission.count({
        where: { assignmentId: assignment.id, score: { gt: fields.maxScore } },
      })
      if (above > 0) {
        return NextResponse.json(
          { error: "Some grades are above the new maximum score", code: "scores_above_max", count: above },
          { status: 409 }
        )
      }
    }
    const updated = await db.assignment.update({ where: { id: assignment.id }, data: fields, include })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "homework.updated",
      entityType: "assignment",
      entityId: assignment.id,
      summary: `Updated homework "${updated.title}"`,
    })
    return NextResponse.json(updated)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update assignment error:", error)
    return NextResponse.json({ error: "Failed to update homework" }, { status: 500 })
  }
}

// DELETE /api/assignments/:id
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const r = await loadManaged(params.id)
    if (r.error) return r.error
    const { session, assignment } = r
    await db.assignment.delete({ where: { id: assignment.id } })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "homework.deleted",
      entityType: "assignment",
      entityId: assignment.id,
      summary: `Deleted homework "${assignment.title}"`,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete assignment error:", error)
    return NextResponse.json({ error: "Failed to delete homework" }, { status: 500 })
  }
}
