import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { onAssignmentSubmitted } from "@/lib/gamification"
import { cleanUrl, isAssignmentTarget } from "@/lib/school"

type Params = { params: { id: string } }

/**
 * PUT /api/assignments/:id/submission { content?, linkUrl? }
 * A target student submits (or edits until graded). Submissions after the
 * due date are flagged late, or refused when the homework does not allow it.
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const assignment = await db.assignment.findUnique({ where: { id: params.id } })
    if (!assignment) return NextResponse.json({ error: "Homework not found" }, { status: 404 })
    if (!(await isAssignmentTarget(assignment, session.user.id))) {
      return NextResponse.json({ error: "This homework is not assigned to you" }, { status: 403 })
    }

    const body = await readJson(request)
    if (body.content != null && typeof body.content !== "string") {
      return NextResponse.json({ error: "content must be text", field: "content" }, { status: 400 })
    }
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 20000) || null : null
    const linkUrl = cleanUrl(body.linkUrl, "linkUrl")
    if (!content && !linkUrl) {
      return NextResponse.json({ error: "Write an answer or add a link", code: "empty" }, { status: 400 })
    }

    const existing = await db.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: session.user.id } },
    })
    if (existing?.gradedAt) {
      return NextResponse.json({ error: "This homework has already been graded", code: "already_graded" }, { status: 409 })
    }
    const now = new Date()
    const late = !!assignment.dueAt && now > assignment.dueAt
    if (late && !assignment.allowLate) {
      return NextResponse.json({ error: "The due date has passed", code: "past_due" }, { status: 409 })
    }

    const submission = await db.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: session.user.id } },
      create: { assignmentId: assignment.id, studentId: session.user.id, content, linkUrl, isLate: late, submittedAt: now },
      update: { content, linkUrl, isLate: late, submittedAt: now },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "homework.submitted",
      entityType: "assignment",
      entityId: assignment.id,
      summary: `${existing ? "Updated" : "Submitted"} homework "${assignment.title}"${late ? " (late)" : ""}`,
    })
    const gamification = existing ? null : await onAssignmentSubmitted(session.user.id, assignment.id)
    return NextResponse.json({ ...submission, gamification }, { status: existing ? 200 : 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Submit homework error:", error)
    return NextResponse.json({ error: "Failed to submit homework" }, { status: 500 })
  }
}
