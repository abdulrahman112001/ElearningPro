import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireInstructor } from "@/lib/instructor-guard"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { zodErrorResponse } from "@/lib/exams"

const importSchema = z.object({
  quizId: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1).max(200),
})

/**
 * POST /api/instructor/question-bank/import — copies bank items into a quiz
 * of one of the teacher's courses (appended after the existing questions).
 * Copies are independent: editing the bank later does not change the quiz.
 */
export async function POST(request: Request) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const userId = g.session.user.id

    const { quizId, itemIds } = importSchema.parse(await readJson(request))

    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        lesson: { select: { chapter: { select: { course: { select: { instructorId: true } } } } } },
        questions: { select: { position: true }, orderBy: { position: "desc" }, take: 1 },
      },
    })
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    if (quiz.lesson.chapter.course.instructorId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const uniqueIds = Array.from(new Set(itemIds))
    const items = await db.questionBankItem.findMany({
      where: { id: { in: uniqueIds }, instructorId: userId },
    })
    if (items.length !== uniqueIds.length) {
      return NextResponse.json({ error: "Some questions were not found in your bank", code: "items_not_found" }, { status: 404 })
    }
    // Keep the order the teacher picked them in.
    const byId = new Map(items.map((i) => [i.id, i]))
    const ordered = uniqueIds.map((id) => byId.get(id)!)

    let position = (quiz.questions[0]?.position ?? -1) + 1
    const created = await db.$transaction(
      ordered.map((item) =>
        db.quizQuestion.create({
          data: {
            quizId: quiz.id,
            question: item.question,
            questionAr: item.questionAr,
            type: item.type,
            options: item.options as any,
            explanation: item.explanation,
            explanationAr: item.explanationAr,
            imageUrl: item.imageUrl,
            points: item.points,
            position: position++,
          },
        })
      )
    )

    await logActivity({
      actorId: userId,
      actorRole: g.session.user.role,
      action: "question_bank.imported",
      entityType: "quiz",
      entityId: quiz.id,
      summary: `Imported ${created.length} question(s) from the bank into "${quiz.title}"`,
      metadata: { itemIds: uniqueIds },
    })

    return NextResponse.json({ imported: created.length, questions: created }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error)
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Question bank import error:", error)
    return NextResponse.json({ error: "Failed to import questions" }, { status: 500 })
  }
}
