import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCourseAccess } from "@/lib/access"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import {
  onCourseCompleted,
  onLearningActivity,
  onLessonCompleted,
  type GamificationResult,
} from "@/lib/gamification"

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await readJson(request)
    const { lessonId, watchedDuration, completed } = body

    if (!lessonId) {
      return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
    }

    // Get lesson and course info
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          select: {
            courseId: true,
            course: { select: { id: true, instructorId: true, classGroupId: true } },
          },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const courseId = lesson.chapter.courseId

    // Enrollment or an active teacher subscription
    const access = await getCourseAccess(session.user, lesson.chapter.course)

    if (!access.allowed) {
      return NextResponse.json(
        { error: "Not enrolled in this course" },
        { status: 403 }
      )
    }

    // A lesson with a quiz is completed by passing the quiz (quiz/submit
    // marks it), not by a client claim. Otherwise the whole course, and its
    // certificate, could be "completed" with a few API calls.
    if (completed === true) {
      const quiz = await db.quiz.findUnique({
        where: { lessonId },
        select: { id: true },
      })
      if (quiz) {
        const passedAttempt = await db.quizAttempt.findFirst({
          where: { quizId: quiz.id, userId: session.user.id, passed: true },
          select: { id: true },
        })
        if (!passedAttempt) {
          return NextResponse.json(
            {
              error: "Pass the lesson quiz to complete this lesson",
              errorAr: "يجب اجتياز اختبار الدرس لإكماله",
            },
            { status: 400 }
          )
        }
      }
    }

    const watched =
      typeof watchedDuration === "number" && watchedDuration > 0
        ? Math.floor(watchedDuration)
        : 0

    const before = await db.progress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
      select: { isCompleted: true },
    })

    // Update or create lesson progress. Periodic watch-time saves do not send
    // `completed`, so they must never un-complete a finished lesson.
    const progress = await db.progress.upsert({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
      update: {
        watchedTime: watched,
        ...(completed === true && { isCompleted: true, completedAt: new Date() }),
      },
      create: {
        userId: session.user.id,
        lessonId,
        watchedTime: watched,
        isCompleted: completed === true,
        ...(completed === true && { completedAt: new Date() }),
      },
    })

    // Update course progress
    const courseJustCompleted = await updateCourseProgress(session.user.id, courseId)

    // Gamification (never throws): points once per lesson/course + daily streak
    let gamification: GamificationResult =
      progress.isCompleted && !before?.isCompleted
        ? await onLessonCompleted(session.user.id, lessonId)
        : await onLearningActivity(session.user.id)
    if (courseJustCompleted) {
      const course = await onCourseCompleted(session.user.id, courseId)
      gamification = {
        ...gamification,
        points: gamification.points + course.points,
        badges: [...gamification.badges, ...course.badges],
      }
    }

    return NextResponse.json({ success: true, progress, gamification })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Progress update error:", error)
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    )
  }
}

/** Recomputes enrollment progress; true when this call completed the course. */
async function updateCourseProgress(userId: string, courseId: string): Promise<boolean> {
  // Get all lessons in course
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        where: { isPublished: true },
        include: {
          lessons: {
            where: { isPublished: true },
          },
        },
      },
    },
  })

  if (!course) return false

  const allLessonIds = course.chapters.flatMap((ch) =>
    ch.lessons.map((l) => l.id)
  )
  const totalLessons = allLessonIds.length

  if (totalLessons === 0) return false

  // Count completed lessons
  const completedCount = await db.progress.count({
    where: {
      userId,
      lessonId: { in: allLessonIds },
      isCompleted: true,
    },
  })

  const progressPercentage = Math.round((completedCount / totalLessons) * 100)

  const previous = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { isCompleted: true },
  })
  if (!previous) return false

  // Update enrollment progress
  await db.enrollment.update({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    data: {
      progress: progressPercentage,
      isCompleted: progressPercentage === 100,
      completedAt: progressPercentage === 100 ? new Date() : null,
    },
  })

  return progressPercentage === 100 && !previous.isCompleted
}
