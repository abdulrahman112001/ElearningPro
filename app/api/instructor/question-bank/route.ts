import { NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { requireInstructor } from "@/lib/instructor-guard"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { DIFFICULTIES, QUESTION_TYPES, bankItemData, bankItemSchema, zodErrorResponse } from "@/lib/exams"

const MAX_ITEMS_PER_TEACHER = 5000

/**
 * GET /api/instructor/question-bank — the teacher's own bank items.
 * Filters: q, subject, gradeLevelId, tag, difficulty, type; page, pageSize.
 */
export async function GET(request: Request) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const userId = g.session.user.id

    const sp = new URL(request.url).searchParams
    const page = Math.max(1, parseInt(sp.get("page") || "1") || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20") || 20))
    const q = sp.get("q")?.trim()
    const subject = sp.get("subject")?.trim()
    const gradeLevelId = sp.get("gradeLevelId")?.trim()
    const tag = sp.get("tag")?.trim()
    const difficulty = sp.get("difficulty")?.trim()
    const type = sp.get("type")?.trim()

    const where: Prisma.QuestionBankItemWhereInput = { instructorId: userId }
    if (q) {
      where.OR = [
        { question: { contains: q, mode: "insensitive" } },
        { questionAr: { contains: q, mode: "insensitive" } },
      ]
    }
    if (subject) where.subject = subject
    if (gradeLevelId) where.gradeLevelId = gradeLevelId
    if (tag) where.tags = { has: tag }
    if (difficulty && (DIFFICULTIES as readonly string[]).includes(difficulty)) {
      where.difficulty = difficulty
    }
    if (type && (QUESTION_TYPES as readonly string[]).includes(type)) {
      where.type = type as (typeof QUESTION_TYPES)[number]
    }

    const [items, total, facets] = await Promise.all([
      db.questionBankItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.questionBankItem.count({ where }),
      db.questionBankItem.findMany({
        where: { instructorId: userId },
        select: { subject: true, tags: true },
      }),
    ])

    const subjects = Array.from(new Set(facets.map((f) => f.subject).filter((s): s is string => !!s))).sort()
    const tags = Array.from(new Set(facets.flatMap((f) => f.tags))).sort()

    return NextResponse.json({ items, total, page, pageSize, subjects, tags })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Question bank list error:", error)
    return NextResponse.json({ error: "Failed to load the question bank" }, { status: 500 })
  }
}

/** POST /api/instructor/question-bank — add a question to the teacher's bank. */
export async function POST(request: Request) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const userId = g.session.user.id

    const data = bankItemSchema.parse(await readJson(request))
    if (data.gradeLevelId) {
      const grade = await db.gradeLevel.findUnique({ where: { id: data.gradeLevelId }, select: { id: true } })
      if (!grade) return NextResponse.json({ error: "Grade level not found", field: "gradeLevelId" }, { status: 400 })
    }
    const count = await db.questionBankItem.count({ where: { instructorId: userId } })
    if (count >= MAX_ITEMS_PER_TEACHER) {
      return NextResponse.json({ error: "Question bank is full", code: "bank_full" }, { status: 400 })
    }

    const item = await db.questionBankItem.create({
      data: { ...bankItemData(data), instructorId: userId },
    })

    await logActivity({
      actorId: userId,
      actorRole: g.session.user.role,
      action: "question_bank.created",
      entityType: "question_bank_item",
      entityId: item.id,
      summary: `Added a ${item.type} question to the question bank`,
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error)
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Question bank create error:", error)
    return NextResponse.json({ error: "Failed to save the question" }, { status: 500 })
  }
}
