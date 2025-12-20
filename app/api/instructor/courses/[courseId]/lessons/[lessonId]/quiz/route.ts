import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

// Option structure matching Prisma schema
const optionSchema = z.object({
  id: z.string(),
  text: z.string(),
  textAr: z.string().optional(),
  isCorrect: z.boolean(),
})

const quizSchema = z.object({
  title: z.string().min(1, "Title is required"),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimit: z.number().min(1).optional().nullable(),
  shuffleQuestions: z.boolean().default(false),
  questions: z.array(
    z.object({
      question: z.string().min(1, "Question text is required"),
      questionAr: z.string().optional(),
      type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTIPLE_SELECT"]),
      options: z.array(optionSchema), // JSON array with id, text, textAr, isCorrect
      explanation: z.string().optional(),
      explanationAr: z.string().optional(),
      points: z.number().min(1).default(1),
      position: z.number(),
    })
  ),
})

// Create quiz for a lesson
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId, lessonId } = params

    // Verify course ownership
    const course = await db.course.findFirst({
      where: {
        id: courseId,
        instructorId: session.user.id,
      },
    })

    if (!course) {
      return NextResponse.json(
        { error: "Course not found", errorAr: "الدورة غير موجودة" },
        { status: 404 }
      )
    }

    // Verify lesson exists
    const lesson = await db.lesson.findFirst({
      where: {
        id: lessonId,
        chapter: { courseId },
      },
    })

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found", errorAr: "الدرس غير موجود" },
        { status: 404 }
      )
    }

    // Check if quiz already exists
    const existingQuiz = await db.quiz.findFirst({
      where: { lessonId },
    })

    if (existingQuiz) {
      return NextResponse.json(
        {
          error: "Quiz already exists for this lesson",
          errorAr: "يوجد اختبار بالفعل لهذا الدرس",
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = quizSchema.parse(body)

    // Create quiz with questions
    const quiz = await db.quiz.create({
      data: {
        title: validatedData.title,
        titleAr: validatedData.titleAr,
        description: validatedData.description,
        passingScore: validatedData.passingScore,
        timeLimit: validatedData.timeLimit,
        shuffleQuestions: validatedData.shuffleQuestions,
        lessonId,
        questions: {
          create: validatedData.questions.map((q) => ({
            question: q.question,
            questionAr: q.questionAr,
            type: q.type,
            options: q.options, // JSON array
            explanation: q.explanation,
            explanationAr: q.explanationAr,
            points: q.points,
            position: q.position,
          })),
        },
      },
      include: {
        questions: true,
      },
    })

    return NextResponse.json(quiz, { status: 201 })
  } catch (error) {
    console.error("Create quiz error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create quiz", errorAr: "فشل إنشاء الاختبار" },
      { status: 500 }
    )
  }
}

// Update quiz
export async function PATCH(
  request: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId, lessonId } = params

    // Verify course ownership
    const course = await db.course.findFirst({
      where: {
        id: courseId,
        instructorId: session.user.id,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // Get existing quiz
    const existingQuiz = await db.quiz.findFirst({
      where: { lessonId },
    })

    if (!existingQuiz) {
      return NextResponse.json(
        { error: "Quiz not found", errorAr: "الاختبار غير موجود" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = quizSchema.parse(body)

    // Delete existing questions
    await db.quizQuestion.deleteMany({
      where: { quizId: existingQuiz.id },
    })

    // Update quiz with new questions
    const quiz = await db.quiz.update({
      where: { id: existingQuiz.id },
      data: {
        title: validatedData.title,
        titleAr: validatedData.titleAr,
        description: validatedData.description,
        passingScore: validatedData.passingScore,
        timeLimit: validatedData.timeLimit,
        shuffleQuestions: validatedData.shuffleQuestions,
        questions: {
          create: validatedData.questions.map((q) => ({
            question: q.question,
            questionAr: q.questionAr,
            type: q.type,
            options: q.options, // JSON array
            explanation: q.explanation,
            explanationAr: q.explanationAr,
            points: q.points,
            position: q.position,
          })),
        },
      },
      include: {
        questions: true,
      },
    })

    return NextResponse.json(quiz)
  } catch (error) {
    console.error("Update quiz error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update quiz", errorAr: "فشل تحديث الاختبار" },
      { status: 500 }
    )
  }
}

// Delete quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId, lessonId } = params

    // Verify course ownership
    const course = await db.course.findFirst({
      where: {
        id: courseId,
        instructorId: session.user.id,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // Get existing quiz
    const existingQuiz = await db.quiz.findFirst({
      where: { lessonId },
    })

    if (!existingQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Delete quiz (cascade will delete questions)
    await db.quiz.delete({
      where: { id: existingQuiz.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete quiz error:", error)
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    )
  }
}
