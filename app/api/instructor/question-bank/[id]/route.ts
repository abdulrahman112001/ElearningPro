import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireInstructor } from "@/lib/instructor-guard"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { bankItemData, bankItemSchema, zodErrorResponse } from "@/lib/exams"

type Ctx = { params: { id: string } }

/** The item when it belongs to the signed-in teacher (others get 404). */
async function ownedItem(id: string, userId: string) {
  return db.questionBankItem.findFirst({ where: { id, instructorId: userId } })
}

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const item = await ownedItem(params.id, g.session.user.id)
    if (!item) return NextResponse.json({ error: "Question not found" }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Question bank get error:", error)
    return NextResponse.json({ error: "Failed to load the question" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const item = await ownedItem(params.id, g.session.user.id)
    if (!item) return NextResponse.json({ error: "Question not found" }, { status: 404 })

    const data = bankItemSchema.parse(await readJson(request))
    if (data.gradeLevelId) {
      const grade = await db.gradeLevel.findUnique({ where: { id: data.gradeLevelId }, select: { id: true } })
      if (!grade) return NextResponse.json({ error: "Grade level not found", field: "gradeLevelId" }, { status: 400 })
    }
    const updated = await db.questionBankItem.update({ where: { id: item.id }, data: bankItemData(data) })

    await logActivity({
      actorId: g.session.user.id,
      actorRole: g.session.user.role,
      action: "question_bank.updated",
      entityType: "question_bank_item",
      entityId: item.id,
      summary: "Edited a question in the question bank",
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error)
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Question bank update error:", error)
    return NextResponse.json({ error: "Failed to save the question" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const g = await requireInstructor()
    if (g.error) return g.error
    const item = await ownedItem(params.id, g.session.user.id)
    if (!item) return NextResponse.json({ error: "Question not found" }, { status: 404 })

    await db.questionBankItem.delete({ where: { id: item.id } })

    await logActivity({
      actorId: g.session.user.id,
      actorRole: g.session.user.role,
      action: "question_bank.deleted",
      entityType: "question_bank_item",
      entityId: item.id,
      summary: "Deleted a question from the question bank",
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Question bank delete error:", error)
    return NextResponse.json({ error: "Failed to delete the question" }, { status: 500 })
  }
}
