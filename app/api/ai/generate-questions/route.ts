import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { generateStructured } from "@/lib/ai/client"
import { aiAvailabilityResponse, aiErrorResponse, recordAiUsage } from "@/lib/ai/guard"
import { courseMaterial, loadCourseForAi } from "@/lib/ai/content"
import { GeneratedQuestionsSchema, QUESTION_SYSTEM, questionPrompt } from "@/lib/ai/prompts"
import { parseGenerateRequest, validateGeneratedQuestions } from "@/lib/ai/validate"

export const maxDuration = 120

/**
 * POST /api/ai/generate-questions
 * { lessonId? | courseId?, count 1-20, types[], difficulty, language "ar"|"en"|"both" }
 * Course owner (approved instructor) or admin. Returns { questions: GeneratedQuestion[] }.
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = session.user.role
    if (role !== "INSTRUCTOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const pending = pendingInstructorResponse(session)
    if (pending) return pending

    const parsed = parseGenerateRequest(await readJson(request))
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid request", code: "validation", fields: parsed.errors }, { status: 400 })
    }
    const input = parsed.value

    let courseId = input.courseId
    if (input.lessonId) {
      const lesson = await db.lesson.findUnique({
        where: { id: input.lessonId },
        select: { chapter: { select: { courseId: true } } },
      })
      if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
      courseId = lesson.chapter.courseId
    }
    const course = await loadCourseForAi(courseId!)
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
    if (role !== "ADMIN" && course.instructorId !== session.user.id) {
      return NextResponse.json({ error: "Only the course owner can generate questions" }, { status: 403 })
    }

    const unavailable = await aiAvailabilityResponse(session.user.id)
    if (unavailable) return unavailable

    const material = courseMaterial(course, input.lessonId)
    const { data, usage } = await generateStructured({
      system: QUESTION_SYSTEM,
      prompt: questionPrompt({ ...input, material: material.text, truncated: material.truncated }),
      schema: GeneratedQuestionsSchema,
      maxTokens: 16000,
      effort: "medium",
    })
    await recordAiUsage(session.user.id, "generate_questions", usage)

    const { questions, rejected } = validateGeneratedQuestions(data.questions, {
      types: input.types,
      language: input.language,
      max: input.count,
    })
    if (rejected.length) console.warn("AI questions rejected:", rejected)
    if (!questions.length) {
      return NextResponse.json({ error: "The AI could not produce valid questions", code: "ai_bad_output" }, { status: 502 })
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: role,
      action: "ai.questions_generated",
      entityType: input.lessonId ? "Lesson" : "Course",
      entityId: input.lessonId ?? course.id,
      summary: `Generated ${questions.length} questions with AI`,
      metadata: { courseId: course.id, count: questions.length, types: input.types, difficulty: input.difficulty },
    })

    return NextResponse.json({ questions, rejected: rejected.length })
  } catch (error) {
    const handled = apiErrorResponse(error) ?? aiErrorResponse(error)
    if (handled) return handled
    console.error("AI generate questions error:", error)
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 })
  }
}
