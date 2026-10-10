import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { getCourseAccess } from "@/lib/access"
import { isAiConfigured, streamChat, type Anthropic } from "@/lib/ai/client"
import {
  aiAvailabilityResponse,
  aiErrorResponse,
  aiNotConfiguredResponse,
  localeFromRequest,
  recordAiUsage,
} from "@/lib/ai/guard"
import { courseOutline, findLessonCourseId, lessonContext, loadCourseForAi } from "@/lib/ai/content"
import { tutorSystem } from "@/lib/ai/prompts"
import { MAX_TUTOR_MESSAGE } from "@/lib/ai/validate"

export const maxDuration = 120

const HISTORY = 10

async function resolveCourse(userId: string, role: string | undefined, courseId: unknown) {
  if (typeof courseId !== "string" || !courseId.trim()) {
    return { error: NextResponse.json({ error: "courseId is required", code: "validation" }, { status: 400 }) }
  }
  const course = await loadCourseForAi(courseId)
  if (!course) return { error: NextResponse.json({ error: "Course not found" }, { status: 404 }) }
  const access = await getCourseAccess({ id: userId, role }, course)
  if (!access.allowed) {
    return { error: NextResponse.json({ error: "No access to this course", code: access.reason }, { status: 403 }) }
  }
  return { course }
}

/** GET /api/ai/tutor?courseId= : the student's conversation in this course (oldest first). */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { course, error } = await resolveCourse(
      session.user.id,
      session.user.role,
      new URL(request.url).searchParams.get("courseId")
    )
    if (error) return error
    if (!isAiConfigured()) return aiNotConfiguredResponse()
    const messages = await db.aiTutorMessage.findMany({
      where: { userId: session.user.id, courseId: course.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, role: true, content: true, lessonId: true, createdAt: true },
    })
    return NextResponse.json({ messages: messages.reverse() })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("AI tutor history error:", error)
    return NextResponse.json({ error: "Failed to load the conversation" }, { status: 500 })
  }
}

/** DELETE /api/ai/tutor?courseId= : clears the conversation (works even when AI is disabled). */
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const courseId = new URL(request.url).searchParams.get("courseId")
    if (!courseId) return NextResponse.json({ error: "courseId is required", code: "validation" }, { status: 400 })
    const { count } = await db.aiTutorMessage.deleteMany({ where: { userId: session.user.id, courseId } })
    return NextResponse.json({ deleted: count })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("AI tutor clear error:", error)
    return NextResponse.json({ error: "Failed to clear the conversation" }, { status: 500 })
  }
}

/**
 * POST /api/ai/tutor { courseId, lessonId?, message }
 * Streams the answer as text/plain chunks. Both turns are stored.
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id
    const body = await readJson(request)
    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message || message.length > MAX_TUTOR_MESSAGE) {
      return NextResponse.json(
        { error: `Message is required (max ${MAX_TUTOR_MESSAGE} characters)`, code: "validation" },
        { status: 400 }
      )
    }
    const lessonId = body.lessonId == null || body.lessonId === "" ? null : body.lessonId
    if (lessonId !== null && typeof lessonId !== "string") {
      return NextResponse.json({ error: "Invalid lessonId", code: "validation" }, { status: 400 })
    }

    const { course, error } = await resolveCourse(userId, session.user.role, body.courseId)
    if (error) return error
    if (lessonId && !findLessonCourseId(course, lessonId)) {
      return NextResponse.json({ error: "Lesson not found in this course" }, { status: 404 })
    }

    const unavailable = await aiAvailabilityResponse(userId)
    if (unavailable) return unavailable

    const history = (
      await db.aiTutorMessage.findMany({
        where: { userId, courseId: course.id },
        orderBy: { createdAt: "desc" },
        take: HISTORY,
        select: { role: true, content: true },
      })
    ).reverse()

    // Build alternating turns; the API requires the first message to be from the user.
    const messages: Anthropic.Beta.BetaMessageParam[] = []
    for (const m of history) {
      const role = m.role === "assistant" ? "assistant" : "user"
      if (!messages.length && role === "assistant") continue
      const last = messages[messages.length - 1]
      if (last && last.role === role) last.content = `${last.content as string}\n\n${m.content}`
      else messages.push({ role, content: m.content })
    }
    const last = messages[messages.length - 1]
    if (last && last.role === "user") last.content = `${last.content as string}\n\n${message}`
    else messages.push({ role: "user", content: message })

    await db.aiTutorMessage.create({ data: { userId, courseId: course.id, lessonId, role: "user", content: message } })

    const { textStream, done } = streamChat({
      system: tutorSystem({
        outline: courseOutline(course),
        lesson: lessonContext(course, lessonId),
        locale: localeFromRequest(request),
      }),
      messages,
      maxTokens: 8000,
      effort: "low",
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of textStream) controller.enqueue(encoder.encode(chunk))
          const result = await done
          await recordAiUsage(userId, "tutor", result.usage)
          if (result.text) {
            await db.aiTutorMessage.create({
              data: { userId, courseId: course.id, lessonId, role: "assistant", content: result.text },
            })
          }
        } catch (err) {
          console.error("AI tutor stream error:", err)
          controller.enqueue(encoder.encode("\n\n[[ai_error]]"))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    const handled = apiErrorResponse(error) ?? aiErrorResponse(error)
    if (handled) return handled
    console.error("AI tutor error:", error)
    return NextResponse.json({ error: "Failed to answer" }, { status: 500 })
  }
}
