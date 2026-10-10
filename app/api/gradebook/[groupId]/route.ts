import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { cleanText, isFiniteNumber } from "@/lib/school"
import { buildGradebook, gradebookCsv, loadGradebookContext } from "../_shared"

type Params = { params: { groupId: string } }

/**
 * GET /api/gradebook/:groupId?termId=&includeHomework=1&format=csv
 * termId: empty = current term, "none" = entries without a term.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const url = new URL(request.url)
    const ctx = await loadGradebookContext(params.groupId, session.user, url.searchParams.get("termId"))
    const grid = await buildGradebook(ctx, url.searchParams.get("includeHomework") === "1")

    if (url.searchParams.get("format") === "csv") {
      const name = `gradebook-${ctx.group.name}${ctx.term ? "-" + ctx.term.name : ""}`.replace(/[\\/:*?"<>|\s]+/g, "_")
      return new NextResponse(gradebookCsv(grid), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gradebook.csv"; filename*=UTF-8''${encodeURIComponent(name)}.csv`,
        },
      })
    }
    return NextResponse.json({
      group: ctx.group,
      terms: ctx.terms,
      term: ctx.term,
      access: ctx.access,
      ...grid,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Gradebook error:", error)
    return NextResponse.json({ error: "Failed to load gradebook" }, { status: 500 })
  }
}

type EntryInput = { studentId: string; subject: string; title: string; maxScore: number; weight: number; score: number | null }

/**
 * POST /api/gradebook/:groupId
 * { termId?, entries: [{ studentId, subject, title, maxScore, weight?, score | null }] }
 * Saves all cells in one go (score null clears a cell). Nothing is saved if
 * any cell is invalid; the response lists every invalid cell.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const body = await readJson(request)
    const ctx = await loadGradebookContext(params.groupId, session.user, body.termId ?? null)
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json({ error: "entries is required", field: "entries" }, { status: 400 })
    }
    if (body.entries.length > 5000) {
      return NextResponse.json({ error: "Too many cells in one save" }, { status: 400 })
    }
    const memberIds = new Set(
      (await db.classGroupMember.findMany({ where: { groupId: ctx.group.id }, select: { studentId: true } })).map((m) => m.studentId)
    )

    const errors: { index: number; studentId?: string; field: string; code: string }[] = []
    const clean: EntryInput[] = []
    body.entries.forEach((raw: any, index: number) => {
      const subject = cleanText(raw?.subject, 80)
      const title = cleanText(raw?.title, 120)
      const maxScore = raw?.maxScore
      const weight = raw?.weight ?? 1
      const score = raw?.score
      const studentId = typeof raw?.studentId === "string" ? raw.studentId : ""
      const before = errors.length
      if (!memberIds.has(studentId)) errors.push({ index, studentId, field: "studentId", code: "not_member" })
      if (!subject) errors.push({ index, studentId, field: "subject", code: "required" })
      else if (!ctx.access.full && !ctx.access.subjects.includes(subject)) {
        errors.push({ index, studentId, field: "subject", code: "not_your_subject" })
      }
      if (!title) errors.push({ index, studentId, field: "title", code: "required" })
      if (!isFiniteNumber(maxScore) || maxScore <= 0 || maxScore > 1000) errors.push({ index, studentId, field: "maxScore", code: "invalid" })
      if (!isFiniteNumber(weight) || weight <= 0 || weight > 100) errors.push({ index, studentId, field: "weight", code: "invalid" })
      if (score !== null && (!isFiniteNumber(score) || score < 0 || (isFiniteNumber(maxScore) && score > maxScore))) {
        errors.push({ index, studentId, field: "score", code: "out_of_range" })
      }
      if (errors.length === before) clean.push({ studentId, subject: subject!, title: title!, maxScore, weight, score })
    })
    if (errors.length) {
      return NextResponse.json({ error: "Some scores are invalid", code: "invalid_entries", errors }, { status: 400 })
    }

    const termId = ctx.term?.id ?? null
    let saved = 0
    let cleared = 0
    await db.$transaction(async (tx) => {
      for (const e of clean) {
        const where = {
          groupId: ctx.group.id,
          termId,
          studentId: e.studentId,
          subject: e.subject,
          title: e.title,
          maxScore: e.maxScore,
        }
        const existing = await tx.gradeEntry.findFirst({ where, select: { id: true } })
        if (e.score === null) {
          if (existing) {
            await tx.gradeEntry.delete({ where: { id: existing.id } })
            cleared++
          }
          continue
        }
        if (existing) {
          await tx.gradeEntry.update({
            where: { id: existing.id },
            data: { score: e.score, weight: e.weight, recordedById: session.user.id },
          })
        } else {
          await tx.gradeEntry.create({
            data: { ...where, organizationId: ctx.group.organizationId, score: e.score, weight: e.weight, recordedById: session.user.id },
          })
        }
        saved++
      }
      // Keep one weight per assessment column.
      const columns = new Map<string, EntryInput>()
      for (const e of clean) columns.set(JSON.stringify([e.subject, e.title, e.maxScore]), e)
      for (const e of Array.from(columns.values())) {
        await tx.gradeEntry.updateMany({
          where: { groupId: ctx.group.id, termId, subject: e.subject, title: e.title, maxScore: e.maxScore },
          data: { weight: e.weight },
        })
      }
    }, { timeout: 30_000 })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "gradebook.updated",
      entityType: "classGroup",
      entityId: ctx.group.id,
      summary: `Updated gradebook of "${ctx.group.name}"${ctx.term ? ` (${ctx.term.name})` : ""}: ${saved} saved, ${cleared} cleared`,
      metadata: { termId, saved, cleared },
    })
    const grid = await buildGradebook(ctx, false)
    return NextResponse.json({ saved, cleared, ...grid })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Save gradebook error:", error)
    return NextResponse.json({ error: "Failed to save grades" }, { status: 500 })
  }
}

/** DELETE /api/gradebook/:groupId?subject=&title=&maxScore=&termId= : removes an assessment column. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const url = new URL(request.url)
    const ctx = await loadGradebookContext(params.groupId, session.user, url.searchParams.get("termId"))
    const subject = url.searchParams.get("subject") ?? ""
    const title = url.searchParams.get("title") ?? ""
    const maxScore = Number(url.searchParams.get("maxScore"))
    if (!subject || !title || !Number.isFinite(maxScore)) {
      return NextResponse.json({ error: "subject, title and maxScore are required" }, { status: 400 })
    }
    if (!ctx.access.full && !ctx.access.subjects.includes(subject)) {
      return NextResponse.json({ error: "Not your subject" }, { status: 403 })
    }
    const { count } = await db.gradeEntry.deleteMany({
      where: { groupId: ctx.group.id, termId: ctx.term?.id ?? null, subject, title, maxScore },
    })
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "gradebook.updated",
      entityType: "classGroup",
      entityId: ctx.group.id,
      summary: `Removed assessment "${subject} - ${title}" from "${ctx.group.name}" (${count} marks)`,
      metadata: { termId: ctx.term?.id ?? null, removed: count },
    })
    return NextResponse.json({ removed: count })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete gradebook column error:", error)
    return NextResponse.json({ error: "Failed to remove assessment" }, { status: 500 })
  }
}
