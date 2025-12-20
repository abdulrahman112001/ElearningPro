import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quizId } = await req.json()

    if (!quizId) {
      return NextResponse.json(
        { error: "Quiz ID is required" },
        { status: 400 }
      )
    }

    // Get quiz with lesson and course info
    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    })

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Check if user is enrolled
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: quiz.lesson.chapter.course.id,
        },
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "You must be enrolled to take this quiz" },
        { status: 403 }
      )
    }

    // Check for existing incomplete attempt
    const existingAttempt = await db.quizAttempt.findFirst({
      where: {
        quizId,
        userId: session.user.id,
        completedAt: null,
      },
    })

    if (existingAttempt) {
      return NextResponse.json({ attemptId: existingAttempt.id })
    }

    // Create new attempt
    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: session.user.id,
        score: 0,
        passed: false,
      },
    })

    return NextResponse.json({ attemptId: attempt.id })
  } catch (error) {
    console.error("[QUIZ_START]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
