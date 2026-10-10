import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCourseAccess } from "@/lib/access"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { questionContentSchema, sanitizeQuestion } from "@/lib/exams"
import { z } from "zod"

// Get quiz for a lesson
export async function GET(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const quiz = await db.quiz.findUnique({
      where: { lessonId: params.lessonId },
      include: {
        questions: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            question: true,
            questionAr: true,
            type: true,
            options: true,
            points: true,
            position: true,
            imageUrl: true,
            // Don't include correct answers for students
          },
        },
        lesson: {
          select: {
            id: true,
            titleEn: true,
            titleAr: true,
            chapter: {
              select: {
                course: {
                  select: {
                    id: true,
                    instructorId: true,
                    classGroupId: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Check if user is instructor or has access
    const isInstructor =
      quiz.lesson.chapter.course.instructorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    // If not instructor/admin, check enrollment
    if (!isInstructor && !isAdmin) {
      const access = await getCourseAccess(session.user, quiz.lesson.chapter.course)

      if (!access.allowed) {
        return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
      }

      // Remove correct answers for students
      const sanitizedQuiz = {
        ...quiz,
        // isCorrect / explanations are never included
        questions: quiz.questions.map((q) => ({ ...sanitizeQuestion(q), position: q.position })),
      }

      return NextResponse.json(sanitizedQuiz)
    }

    return NextResponse.json(quiz)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get quiz error:", error)
    return NextResponse.json({ error: "Failed to get quiz" }, { status: 500 })
  }
}

// Create or update quiz for a lesson
export async function POST(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify lesson ownership
    const lesson = await db.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    if (
      lesson.chapter.course.instructorId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await readJson(request)
    const {
      title,
      titleAr,
      description,
      passingScore,
      timeLimit,
      shuffleQuestions,
      showResults,
      questions,
    } = body

    // Create or update quiz
    const quiz = await db.quiz.upsert({
      where: { lessonId: params.lessonId },
      update: {
        title,
        titleAr,
        description,
        passingScore: passingScore || 70,
        timeLimit,
        shuffleQuestions: shuffleQuestions ?? false,
        showResults: showResults ?? true,
      },
      create: {
        lessonId: params.lessonId,
        title,
        titleAr,
        description,
        passingScore: passingScore || 70,
        timeLimit,
        shuffleQuestions: shuffleQuestions ?? false,
        showResults: showResults ?? true,
      },
    })

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      // Delete existing questions
      await db.quizQuestion.deleteMany({
        where: { quizId: quiz.id },
      })

      // Create new questions
      const parsed = z.array(questionContentSchema).parse(
        questions.map((q: any) => ({ ...q, type: q?.type || "MULTIPLE_CHOICE" }))
      )
      await db.quizQuestion.createMany({
        data: parsed.map((q, index) => ({
          quizId: quiz.id,
          question: q.question,
          questionAr: q.questionAr || null,
          type: q.type,
          options: q.options,
          explanation: q.explanation || null,
          explanationAr: q.explanationAr || null,
          points: q.points,
          imageUrl: q.imageUrl,
          position: index,
        })),
      })
    }

    const updatedQuiz = await db.quiz.findUnique({
      where: { id: quiz.id },
      include: {
        questions: {
          orderBy: { position: "asc" },
        },
      },
    })

    return NextResponse.json(updatedQuiz)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create quiz error:", error)
    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 }
    )
  }
}

// Delete quiz
export async function DELETE(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify lesson ownership
    const lesson = await db.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    if (
      lesson.chapter.course.instructorId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.quiz.delete({
      where: { lessonId: params.lessonId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete quiz error:", error)
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    )
  }
}
