import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

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
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: session.user.id,
            courseId: quiz.lesson.chapter.course.id,
          },
        },
      })

      if (!enrollment) {
        return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
      }

      // Remove correct answers for students
      const sanitizedQuiz = {
        ...quiz,
        questions: quiz.questions.map((q) => ({
          ...q,
          options: (q.options as any[]).map((opt) => ({
            id: opt.id,
            text: opt.text,
            textAr: opt.textAr,
            // isCorrect is not included
          })),
        })),
      }

      return NextResponse.json(sanitizedQuiz)
    }

    return NextResponse.json(quiz)
  } catch (error) {
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

    const body = await request.json()
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
      await db.quizQuestion.createMany({
        data: questions.map((q: any, index: number) => ({
          quizId: quiz.id,
          question: q.question,
          questionAr: q.questionAr,
          type: q.type || "MULTIPLE_CHOICE",
          options: q.options,
          explanation: q.explanation,
          explanationAr: q.explanationAr,
          points: q.points || 1,
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
    console.error("Delete quiz error:", error)
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    )
  }
}
