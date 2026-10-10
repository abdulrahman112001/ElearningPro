import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { questionContentSchema } from "@/lib/exams"

const dateField = z
  .union([z.string().datetime({ offset: true }), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null))

const quizSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(300),
    titleAr: z.string().max(300).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    passingScore: z.number().min(0).max(100).default(70),
    timeLimit: z.number().int().min(1).max(1440).optional().nullable(),
    shuffleQuestions: z.boolean().default(false),
    showResults: z.boolean().default(true),
    // Exam settings
    availableFrom: dateField,
    availableUntil: dateField,
    maxAttempts: z.number().int().min(1).max(100).optional().nullable(),
    questionsPerAttempt: z.number().int().min(1).max(500).optional().nullable(),
    detectTabSwitch: z.boolean().default(true),
    questions: z
      .array(
        z.intersection(
          questionContentSchema,
          z.object({ id: z.string().optional(), position: z.number().int().min(0).optional() })
        )
      )
      .max(500),
  })
  .superRefine((q, ctx) => {
    if (q.availableFrom && q.availableUntil && q.availableUntil <= q.availableFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The closing time must be after the opening time",
        path: ["availableUntil"],
      })
    }
    if (q.questionsPerAttempt && q.questionsPerAttempt > q.questions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Questions per attempt cannot exceed the number of questions",
        path: ["questionsPerAttempt"],
      })
    }
  })

type QuizInput = z.infer<typeof quizSchema>

function settingsData(v: QuizInput) {
  return {
    title: v.title,
    titleAr: v.titleAr || null,
    description: v.description || null,
    passingScore: v.passingScore,
    timeLimit: v.timeLimit ?? null,
    shuffleQuestions: v.shuffleQuestions,
    showResults: v.showResults,
    availableFrom: v.availableFrom,
    availableUntil: v.availableUntil,
    maxAttempts: v.maxAttempts ?? null,
    questionsPerAttempt: v.questionsPerAttempt ?? null,
    detectTabSwitch: v.detectTabSwitch,
  }
}

function questionData(q: QuizInput["questions"][number], index: number) {
  return {
    question: q.question,
    questionAr: q.questionAr || null,
    type: q.type,
    options: q.options,
    explanation: q.explanation || null,
    explanationAr: q.explanationAr || null,
    points: q.points,
    imageUrl: q.imageUrl,
    position: index,
  }
}

/** The course when the user owns it (or is an admin) and the lesson belongs to it. */
async function loadOwnedLesson(session: Session, courseId: string, lessonId: string) {
  const course = await db.course.findFirst({
    where: session.user.role === "ADMIN" ? { id: courseId } : { id: courseId, instructorId: session.user.id },
    select: { id: true },
  })
  if (!course) return null
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, chapter: { courseId } },
    select: { id: true },
  })
  if (!lesson) return null
  return course
}

async function guard() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const pending = pendingInstructorResponse(session)
  if (pending) return { error: pending }
  return { session }
}

function zodError(error: z.ZodError) {
  const issue = error.errors[0]
  const path = issue.path.join(".")
  return NextResponse.json({ error: issue.message, field: path || undefined }, { status: 400 })
}

// Quiz with its answer key, for the editor
export async function GET(
  _request: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const g = await guard()
    if (g.error) return g.error
    const course = await loadOwnedLesson(g.session, params.courseId, params.lessonId)
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    const quiz = await db.quiz.findUnique({
      where: { lessonId: params.lessonId },
      include: { questions: { orderBy: { position: "asc" } } },
    })
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    return NextResponse.json(quiz)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get quiz error:", error)
    return NextResponse.json({ error: "Failed to load quiz" }, { status: 500 })
  }
}

// Create quiz for a lesson
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const g = await guard()
    if (g.error) return g.error
    const { courseId, lessonId } = params

    const course = await loadOwnedLesson(g.session, courseId, lessonId)
    if (!course) {
      return NextResponse.json(
        { error: "Course not found", errorAr: "الدورة غير موجودة" },
        { status: 404 }
      )
    }

    const existingQuiz = await db.quiz.findFirst({ where: { lessonId } })
    if (existingQuiz) {
      return NextResponse.json(
        {
          error: "Quiz already exists for this lesson",
          errorAr: "يوجد اختبار بالفعل لهذا الدرس",
        },
        { status: 400 }
      )
    }

    const validated = quizSchema.parse(await readJson(request))

    const quiz = await db.quiz.create({
      data: {
        ...settingsData(validated),
        lessonId,
        questions: { create: validated.questions.map(questionData) },
      },
      include: { questions: { orderBy: { position: "asc" } } },
    })

    await logActivity({
      actorId: g.session.user.id,
      actorRole: g.session.user.role,
      action: "quiz.created",
      entityType: "quiz",
      entityId: quiz.id,
      summary: `Created quiz "${quiz.title}" (${quiz.questions.length} questions)`,
      metadata: { courseId, lessonId },
    })

    return NextResponse.json(quiz, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return zodError(error)
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create quiz error:", error)
    return NextResponse.json(
      { error: "Failed to create quiz", errorAr: "فشل إنشاء الاختبار" },
      { status: 500 }
    )
  }
}

// Update quiz. Questions sent with their existing id are updated in place so
// past attempts keep their answers; questions left out are deleted.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const g = await guard()
    if (g.error) return g.error
    const { courseId, lessonId } = params

    const course = await loadOwnedLesson(g.session, courseId, lessonId)
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    // The lesson must belong to the course whose ownership was just verified.
    const existingQuiz = await db.quiz.findFirst({
      where: { lessonId, lesson: { chapter: { courseId } } },
      include: { questions: { select: { id: true } } },
    })
    if (!existingQuiz) {
      return NextResponse.json(
        { error: "Quiz not found", errorAr: "الاختبار غير موجود" },
        { status: 404 }
      )
    }

    const validated = quizSchema.parse(await readJson(request))
    const existingIds = new Set(existingQuiz.questions.map((q) => q.id))
    const keptIds = new Set(
      validated.questions.map((q) => q.id).filter((id): id is string => !!id && existingIds.has(id))
    )

    const quiz = await db.$transaction(async (tx) => {
      await tx.quizQuestion.deleteMany({
        where: { quizId: existingQuiz.id, id: { notIn: Array.from(keptIds) } },
      })
      for (let index = 0; index < validated.questions.length; index++) {
        const q = validated.questions[index]
        const data = questionData(q, index)
        if (q.id && keptIds.has(q.id)) {
          await tx.quizQuestion.update({ where: { id: q.id }, data })
        } else {
          await tx.quizQuestion.create({ data: { ...data, quizId: existingQuiz.id } })
        }
      }
      return tx.quiz.update({
        where: { id: existingQuiz.id },
        data: settingsData(validated),
        include: { questions: { orderBy: { position: "asc" } } },
      })
    })

    await logActivity({
      actorId: g.session.user.id,
      actorRole: g.session.user.role,
      action: "quiz.updated",
      entityType: "quiz",
      entityId: quiz.id,
      summary: `Updated quiz "${quiz.title}" (${quiz.questions.length} questions)`,
      metadata: { courseId, lessonId },
    })

    return NextResponse.json(quiz)
  } catch (error) {
    if (error instanceof z.ZodError) return zodError(error)
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update quiz error:", error)
    return NextResponse.json(
      { error: "Failed to update quiz", errorAr: "فشل تحديث الاختبار" },
      { status: 500 }
    )
  }
}

// Delete quiz
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const g = await guard()
    if (g.error) return g.error
    const { courseId, lessonId } = params

    const course = await loadOwnedLesson(g.session, courseId, lessonId)
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    const existingQuiz = await db.quiz.findFirst({
      where: { lessonId, lesson: { chapter: { courseId } } },
    })
    if (!existingQuiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

    await db.quiz.delete({ where: { id: existingQuiz.id } })

    await logActivity({
      actorId: g.session.user.id,
      actorRole: g.session.user.role,
      action: "quiz.deleted",
      entityType: "quiz",
      entityId: existingQuiz.id,
      summary: `Deleted quiz "${existingQuiz.title}"`,
      metadata: { courseId, lessonId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete quiz error:", error)
    return NextResponse.json({ error: "Failed to delete quiz" }, { status: 500 })
  }
}
