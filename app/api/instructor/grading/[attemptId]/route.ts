import { NextResponse } from "next/server"
import { z } from "zod"
import type { Session } from "next-auth"
import { db } from "@/lib/db"
import { requireInstructor } from "@/lib/instructor-guard"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { onLessonCompleted, onQuizSubmitted } from "@/lib/gamification"
import {
  attemptQuestions,
  attemptResultLink,
  onQuizPassed,
  recomputeAttempt,
  zodErrorResponse,
} from "@/lib/exams"

type Ctx = { params: { attemptId: string } }

async function loadAttempt(attemptId: string) {
  return db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      answers: true,
      quiz: {
        include: {
          questions: true,
          lesson: {
            select: {
              id: true,
              titleEn: true,
              titleAr: true,
              chapter: {
                select: {
                  course: { select: { id: true, titleEn: true, titleAr: true, slug: true, instructorId: true } },
                },
              },
            },
          },
        },
      },
    },
  })
}

type LoadedAttempt = NonNullable<Awaited<ReturnType<typeof loadAttempt>>>

/** null when allowed, else the error response. Course owner or admin only. */
function forbidden(session: Session, attempt: LoadedAttempt | null) {
  if (!attempt || !attempt.completedAt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
  }
  const ownerId = attempt.quiz.lesson.chapter.course.instructorId
  if (session.user.role !== "ADMIN" && ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

function serialize(attempt: LoadedAttempt) {
  const { quiz } = attempt
  const served = attemptQuestions(attempt.questionIds, quiz.questions)
  return {
    id: attempt.id,
    score: attempt.score,
    passed: attempt.passed,
    needsGrading: attempt.needsGrading,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    timeSpent: attempt.timeSpent,
    tabSwitches: attempt.tabSwitches,
    attemptNumber: attempt.attemptNumber,
    user: attempt.user,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      titleAr: quiz.titleAr,
      passingScore: quiz.passingScore,
      detectTabSwitch: quiz.detectTabSwitch,
      lesson: {
        id: quiz.lesson.id,
        titleEn: quiz.lesson.titleEn,
        titleAr: quiz.lesson.titleAr,
        course: (({ instructorId: _owner, ...c }) => c)(quiz.lesson.chapter.course),
      },
    },
    questions: served.map((q) => {
      const a = attempt.answers.find((x) => x.questionId === q.id)
      return {
        id: q.id,
        question: q.question,
        questionAr: q.questionAr,
        type: q.type,
        points: q.points,
        imageUrl: q.imageUrl,
        options: q.options,
        answer: a
          ? {
              answer: a.answer,
              textAnswer: a.textAnswer,
              isCorrect: a.isCorrect,
              points: a.points,
              manualScore: a.manualScore,
              feedback: a.feedback,
              gradedAt: a.gradedAt,
            }
          : null,
      }
    }),
  }
}

/** GET /api/instructor/grading/[attemptId] — the attempt with the student's answers and the key. */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const attempt = await loadAttempt(params.attemptId)
    const denied = forbidden(g.session, attempt)
    if (denied) return denied
    return NextResponse.json(serialize(attempt!))
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Grading detail error:", error)
    return NextResponse.json({ error: "Failed to load the attempt" }, { status: 500 })
  }
}

const gradeSchema = z.object({
  grades: z
    .array(
      z.object({
        questionId: z.string().min(1),
        score: z.number().min(0),
        feedback: z.string().trim().max(5000).optional().nullable(),
      })
    )
    .min(1)
    .max(500),
})

/**
 * POST /api/instructor/grading/[attemptId] — scores essay answers
 * ({ grades: [{ questionId, score, feedback }] }), recomputes the attempt's
 * score and pass state, and tells the student once nothing is left to grade.
 * Re-grading an already graded essay is allowed.
 */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const attempt = await loadAttempt(params.attemptId)
    const denied = forbidden(g.session, attempt)
    if (denied) return denied
    const a = attempt!

    const { grades } = gradeSchema.parse(await readJson(request))
    const served = new Map(attemptQuestions(a.questionIds, a.quiz.questions).map((q) => [q.id, q]))

    for (const grade of grades) {
      const question = served.get(grade.questionId)
      const answer = a.answers.find((x) => x.questionId === grade.questionId)
      if (!question || question.type !== "ESSAY" || !answer) {
        return NextResponse.json(
          { error: "Only essay answers of this attempt can be graded", code: "not_an_essay", questionId: grade.questionId },
          { status: 400 }
        )
      }
      if (grade.score > question.points) {
        return NextResponse.json(
          { error: `Score must be between 0 and ${question.points}`, code: "score_out_of_range", questionId: grade.questionId },
          { status: 400 }
        )
      }
    }

    const wasPassed = a.passed
    const wasPending = a.needsGrading
    const now = new Date()
    const updated = await db.$transaction(async (tx) => {
      for (const grade of grades) {
        const question = served.get(grade.questionId)!
        await tx.quizAnswer.update({
          where: { attemptId_questionId: { attemptId: a.id, questionId: grade.questionId } },
          data: {
            manualScore: grade.score,
            points: grade.score,
            isCorrect: grade.score >= question.points,
            feedback: grade.feedback || null,
            gradedAt: now,
            gradedById: g.session.user.id,
          },
        })
      }
      return recomputeAttempt(a.id, tx)
    })

    const course = a.quiz.lesson.chapter.course
    if (updated.passed && !wasPassed) {
      await onQuizPassed(a.userId, a.quiz.lessonId, course.id)
    }

    if (!updated.needsGrading) {
      await onQuizSubmitted(a.userId, a.id, updated.score, updated.passed)
      if (updated.passed && !wasPassed) await onLessonCompleted(a.userId, a.quiz.lessonId)
    }

    if (!updated.needsGrading) {
      const title = a.quiz.titleAr || a.quiz.title
      await db.notification.create({
        data: {
          userId: a.userId,
          type: "SYSTEM",
          title: wasPending ? "تم تصحيح اختبارك" : "تم تعديل درجة اختبارك",
          message: `نتيجتك في "${title}": ${Math.round(updated.score)}% — ${updated.passed ? "ناجح" : "لم تنجح هذه المرة"}`,
          link: attemptResultLink(course.slug, a.quiz.lessonId, a.id),
        },
      })
    }

    await logActivity({
      actorId: g.session.user.id,
      actorRole: g.session.user.role,
      action: "exam.graded",
      entityType: "quiz_attempt",
      entityId: a.id,
      summary: `Graded ${grades.length} essay answer(s) on "${a.quiz.title}" for ${a.user.name ?? a.user.email}: ${Math.round(updated.score)}%${updated.needsGrading ? " (more to grade)" : updated.passed ? " (passed)" : " (failed)"}`,
      metadata: {
        quizId: a.quizId,
        studentId: a.userId,
        score: updated.score,
        passed: updated.passed,
        needsGrading: updated.needsGrading,
      },
    })

    const fresh = await loadAttempt(a.id)
    return NextResponse.json(serialize(fresh!))
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error)
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Grading error:", error)
    return NextResponse.json({ error: "Failed to save the grades" }, { status: 500 })
  }
}
