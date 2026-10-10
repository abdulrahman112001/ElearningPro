import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"
import { groupTeachingAccess, weightedPercent, type SessionUser } from "@/lib/school"

/** Loads the group, the caller's access and the term to work in. */
export async function loadGradebookContext(groupId: string, user: SessionUser, termParam: string | null | undefined) {
  const group = await db.classGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      organization: { select: { id: true, name: true, type: true } },
    },
  })
  if (!group) throw new ApiError(404, "Group not found")
  const access = await groupTeachingAccess(groupId, user)
  if (!access) throw new ApiError(403, "You cannot open this group's gradebook")

  const terms = group.organizationId
    ? await db.academicTerm.findMany({
        where: { organizationId: group.organizationId },
        orderBy: { startsAt: "desc" },
        select: { id: true, name: true, startsAt: true, endsAt: true, isCurrent: true },
      })
    : []
  let term: (typeof terms)[number] | null = null
  if (termParam === "none") term = null
  else if (termParam) {
    term = terms.find((t) => t.id === termParam) ?? null
    if (!term) throw new ApiError(400, "Term not found for this group", { field: "termId", code: "invalid_term" })
  } else {
    term = terms.find((t) => t.isCurrent) ?? null
  }
  return { group, access, terms, term }
}

export type Column = {
  key: string
  kind: "grade" | "homework"
  subject: string
  title: string
  maxScore: number
  weight: number
  assignmentId?: string
}

export const columnKey = (subject: string, title: string, maxScore: number) =>
  JSON.stringify([subject, title, maxScore])

/** Builds the grid: students x assessments with per-student weighted averages. */
export async function buildGradebook(
  ctx: Awaited<ReturnType<typeof loadGradebookContext>>,
  includeHomework: boolean
) {
  const { group, access, term } = ctx
  const subjectFilter = access.full ? {} : { subject: { in: access.subjects } }
  const [members, entries, assignments] = await Promise.all([
    db.classGroupMember.findMany({
      where: { groupId: group.id },
      include: { student: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { student: { name: "asc" } },
    }),
    db.gradeEntry.findMany({
      where: { groupId: group.id, termId: term?.id ?? null, ...subjectFilter },
      orderBy: { createdAt: "asc" },
    }),
    includeHomework
      ? db.assignment.findMany({
          where: {
            groupId: group.id,
            ...subjectFilter,
            ...(term ? { OR: [{ dueAt: { gte: term.startsAt, lte: term.endsAt } }, { dueAt: null, createdAt: { gte: term.startsAt, lte: term.endsAt } }] } : {}),
          },
          orderBy: { createdAt: "asc" },
          include: { submissions: { where: { gradedAt: { not: null } }, select: { studentId: true, score: true } } },
        })
      : Promise.resolve([]),
  ])

  const columns: Column[] = []
  const seen = new Map<string, Column>()
  const cells: Record<string, Record<string, number>> = {}
  for (const m of members) cells[m.studentId] = {}

  for (const e of entries) {
    const key = columnKey(e.subject, e.title, e.maxScore)
    if (!seen.has(key)) {
      const col: Column = { key, kind: "grade", subject: e.subject, title: e.title, maxScore: e.maxScore, weight: e.weight }
      seen.set(key, col)
      columns.push(col)
    }
    if (cells[e.studentId]) cells[e.studentId][key] = e.score
  }
  for (const a of assignments) {
    const key = `hw:${a.id}`
    columns.push({
      key,
      kind: "homework",
      subject: a.subject ?? "",
      title: a.title,
      maxScore: a.maxScore,
      weight: 1,
      assignmentId: a.id,
    })
    for (const s of a.submissions) if (cells[s.studentId] && s.score !== null) cells[s.studentId][key] = s.score
  }

  const students = members.map(({ student }) => {
    const marks = columns
      .filter((c) => cells[student.id][c.key] !== undefined)
      .map((c) => ({ score: cells[student.id][c.key], maxScore: c.maxScore, weight: c.weight }))
    return { ...student, average: weightedPercent(marks) }
  })
  return { students, columns, cells }
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function gradebookCsv(grid: Awaited<ReturnType<typeof buildGradebook>>) {
  const header = [
    "Student",
    "Email",
    ...grid.columns.map((c) => `${c.subject ? c.subject + " - " : ""}${c.title} (/${c.maxScore}${c.weight !== 1 ? ` x${c.weight}` : ""})`),
    "Average %",
  ]
  const lines = [header.map(csvCell).join(",")]
  for (const s of grid.students) {
    lines.push(
      [s.name ?? "", s.email ?? "", ...grid.columns.map((c) => grid.cells[s.id][c.key] ?? ""), s.average ?? ""]
        .map(csvCell)
        .join(",")
    )
  }
  // BOM so Excel opens Arabic names correctly.
  return "﻿" + lines.join("\r\n")
}
