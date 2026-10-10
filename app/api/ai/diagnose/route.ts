import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { generateStructured } from "@/lib/ai/client"
import { aiAvailabilityResponse, aiErrorResponse, localeFromRequest, recordAiUsage } from "@/lib/ai/guard"
import { DiagnosisSchema, diagnosisSystem } from "@/lib/ai/prompts"
import { gatherStudentData } from "@/lib/ai/student-data"

export const maxDuration = 120

/**
 * POST /api/ai/diagnose { studentId, courseId?, language? }
 * A teacher of a course the student is enrolled in (or an admin) gets an AI
 * diagnosis of the student's weak points plus ready-to-send messages.
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = session.user.role
    if (role !== "INSTRUCTOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const pending = pendingInstructorResponse(session)
    if (pending) return pending
    const isAdmin = role === "ADMIN"

    const body = await readJson(request)
    const { studentId, courseId } = body
    if (typeof studentId !== "string" || !studentId.trim()) {
      return NextResponse.json({ error: "studentId is required", code: "validation" }, { status: 400 })
    }
    if (courseId != null && (typeof courseId !== "string" || !courseId.trim())) {
      return NextResponse.json({ error: "Invalid courseId", code: "validation" }, { status: 400 })
    }
    const language = body.language === "en" || body.language === "ar" ? body.language : localeFromRequest(request)

    const student = await db.user.findFirst({ where: { id: studentId, role: "STUDENT" }, select: { id: true, name: true } })
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

    // Courses of this teacher (all courses for an admin) that the student is enrolled in.
    const enrolled = await db.enrollment.findMany({
      where: {
        userId: student.id,
        ...(courseId && { courseId }),
        ...(!isAdmin && { course: { instructorId: session.user.id } }),
      },
      select: { courseId: true },
    })
    if (courseId) {
      const course = await db.course.findUnique({ where: { id: courseId }, select: { instructorId: true } })
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
      if (!isAdmin && course.instructorId !== session.user.id) {
        return NextResponse.json({ error: "Not your course" }, { status: 403 })
      }
    }
    if (!enrolled.length) {
      return NextResponse.json({ error: "This student is not enrolled in your courses" }, { status: 403 })
    }

    const unavailable = await aiAvailabilityResponse(session.user.id)
    if (unavailable) return unavailable

    const data = await gatherStudentData({
      studentId: student.id,
      courseIds: enrolled.map((e) => e.courseId),
      teacherId: isAdmin ? null : session.user.id,
    })

    const { data: diagnosis, usage } = await generateStructured({
      system: diagnosisSystem(language),
      prompt: `Student first name: ${(student.name ?? "").split(" ")[0] || "-"}\n\n<student_data>\n${JSON.stringify(data, null, 1)}\n</student_data>`,
      schema: DiagnosisSchema,
      maxTokens: 8000,
      effort: "medium",
    })
    await recordAiUsage(session.user.id, "diagnose", usage)

    await logActivity({
      actorId: session.user.id,
      actorRole: role,
      action: "ai.student_diagnosed",
      entityType: "User",
      entityId: student.id,
      summary: `AI diagnosis for ${student.name ?? student.id}`,
      metadata: { courseId: courseId ?? null },
    })

    return NextResponse.json({
      diagnosis: {
        summary: diagnosis.summary,
        weakTopics: diagnosis.weakTopics.slice(0, 10),
        recommendations: diagnosis.recommendations.slice(0, 10),
        messageToStudent: diagnosis.messageToStudent.slice(0, 3000),
        messageToParent: diagnosis.messageToParent.slice(0, 3000),
      },
      stats: data.totals,
    })
  } catch (error) {
    const handled = apiErrorResponse(error) ?? aiErrorResponse(error)
    if (handled) return handled
    console.error("AI diagnose error:", error)
    return NextResponse.json({ error: "Failed to analyze the student" }, { status: 500 })
  }
}
