import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { studentAssignmentScope } from "@/lib/school"

// GET /api/assignments/mine : the student's homework with their submission status
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const scope = await studentAssignmentScope(session.user.id)
    const assignments = await db.assignment.findMany({
      where: scope,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        group: { select: { id: true, name: true } },
        course: { select: { id: true, titleAr: true, titleEn: true, slug: true } },
        lesson: { select: { id: true, titleAr: true, titleEn: true } },
        teacher: { select: { id: true, name: true, image: true } },
        submissions: { where: { studentId: session.user.id } },
      },
    })
    const now = new Date()
    const rows = assignments.map(({ submissions, ...a }) => {
      const submission = submissions[0] ?? null
      const status = submission?.gradedAt ? "graded" : submission ? "submitted" : "pending"
      const closed = !submission && !!a.dueAt && a.dueAt < now && !a.allowLate
      return { ...a, submission, status, closed }
    })
    return NextResponse.json({ assignments: rows })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("My homework error:", error)
    return NextResponse.json({ error: "Failed to load homework" }, { status: 500 })
  }
}
