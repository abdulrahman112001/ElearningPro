import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { canManageAssignment, isFiniteNumber } from "@/lib/school"

type Params = { params: { id: string; submissionId: string } }

// PATCH /api/assignments/:id/submissions/:submissionId { score, feedback? } : grade a submission
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const submission = await db.assignmentSubmission.findFirst({
      where: { id: params.submissionId, assignmentId: params.id },
      include: { assignment: true },
    })
    if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    const { assignment } = submission
    if (!(await canManageAssignment(session.user, assignment))) {
      return NextResponse.json({ error: "You cannot grade this homework" }, { status: 403 })
    }

    const body = await readJson(request)
    const score = body.score
    if (!isFiniteNumber(score) || score < 0 || score > assignment.maxScore) {
      return NextResponse.json(
        { error: `Score must be between 0 and ${assignment.maxScore}`, field: "score", code: "out_of_range", maxScore: assignment.maxScore },
        { status: 400 }
      )
    }
    if (body.feedback != null && typeof body.feedback !== "string") {
      return NextResponse.json({ error: "feedback must be text", field: "feedback" }, { status: 400 })
    }
    const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 5000) || null : null
    const regrade = !!submission.gradedAt

    const updated = await db.assignmentSubmission.update({
      where: { id: submission.id },
      data: { score, feedback, gradedAt: new Date(), gradedById: session.user.id },
    })
    await db.notification.create({
      data: {
        userId: submission.studentId,
        type: "SYSTEM",
        title: `تم تصحيح الواجب: ${assignment.title}`,
        message: `درجتك ${score} من ${assignment.maxScore}${feedback ? ` - ${feedback.slice(0, 200)}` : ""}`,
        link: "/student/homework?tab=graded",
      },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "homework.graded",
      entityType: "assignment",
      entityId: assignment.id,
      summary: `${regrade ? "Re-graded" : "Graded"} homework "${assignment.title}": ${score}/${assignment.maxScore}`,
      metadata: { submissionId: submission.id, studentId: submission.studentId, score },
    })
    return NextResponse.json(updated)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Grade homework error:", error)
    return NextResponse.json({ error: "Failed to grade homework" }, { status: 500 })
  }
}
