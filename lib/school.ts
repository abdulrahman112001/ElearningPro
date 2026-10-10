import type { OrganizationRole } from "@prisma/client"
import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"
import { canManageGroup, getOrgMembership, ORG_MANAGER_ROLES } from "@/lib/organization"

/**
 * School mode helpers: homework targeting and permissions, gradebook math,
 * timetable conflict detection and report cards.
 */

export type SessionUser = { id: string; role?: string }

// ---------------------------------------------------------------------------
// Small validators
// ---------------------------------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "08:30" -> 510, or null when malformed. */
export function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null
  const m = TIME_RE.exec(value.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Half-open ranges [aStart, aEnd) and [bStart, bEnd) overlap. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const v = value.trim()
  if (!v) return null
  return v.slice(0, max)
}

/** http(s) URL or null. Throws 400 for anything else that is not empty. */
export function cleanUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || value.length > 1000) throw new ApiError(400, `${field} must be a link`, { field, code: "invalid_url" })
  try {
    const u = new URL(value.trim())
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error()
    return u.toString()
  } catch {
    throw new ApiError(400, `${field} must be an http(s) link`, { field, code: "invalid_url" })
  }
}

export function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ApiError(400, `${field} must be a date`, { field, code: "invalid_date" })
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `${field} must be a date`, { field, code: "invalid_date" })
  return d
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

// ---------------------------------------------------------------------------
// Grade math
// ---------------------------------------------------------------------------

export type Mark = { score: number; maxScore: number; weight?: number | null }

/**
 * Weighted percentage of a list of marks: sum(w * score/max) / sum(w) * 100.
 * Marks with max <= 0 or weight <= 0 are ignored. Null when nothing counts.
 */
export function weightedPercent(marks: Mark[]): number | null {
  let num = 0
  let den = 0
  for (const m of marks) {
    const w = m.weight ?? 1
    if (!(m.maxScore > 0) || !(w > 0)) continue
    num += (w * m.score) / m.maxScore
    den += w
  }
  if (den === 0) return null
  return round1((num / den) * 100)
}

export function round1(n: number) {
  return Math.round(n * 10) / 10
}

// ---------------------------------------------------------------------------
// Groups a teacher can work with
// ---------------------------------------------------------------------------

/**
 * Groups the user may manage: groups they teach, groups of organizations they
 * own/manage, and (school mode) groups where they teach a subject. Admins get
 * every group (capped).
 */
export async function listManageableGroups(user: SessionUser) {
  const select = {
    id: true,
    name: true,
    organizationId: true,
    instructorId: true,
    organization: { select: { id: true, name: true, type: true } },
    _count: { select: { members: true } },
  } as const
  if (user.role === "ADMIN") {
    return db.classGroup.findMany({ select, orderBy: { createdAt: "desc" }, take: 300 })
  }
  const managed = await db.organizationMember.findMany({
    where: { userId: user.id, role: { in: ORG_MANAGER_ROLES } },
    select: { organizationId: true },
  })
  return db.classGroup.findMany({
    where: {
      OR: [
        { instructorId: user.id },
        { organizationId: { in: managed.map((m) => m.organizationId) } },
        { subjects: { some: { teacherId: user.id } } },
      ],
    },
    select,
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Access to a group's homework / gradebook. `full` = may manage the group;
 * otherwise `subjects` lists the subjects the user teaches there (school
 * mode subject teachers). Null = no access at all.
 */
export async function groupTeachingAccess(
  groupId: string,
  user: SessionUser
): Promise<{ full: boolean; subjects: string[] } | null> {
  if (await canManageGroup(groupId, user)) return { full: true, subjects: [] }
  const subs = await db.classSubject.findMany({
    where: { groupId, teacherId: user.id },
    select: { subject: true },
  })
  if (subs.length === 0) return null
  return { full: false, subjects: subs.map((s) => s.subject) }
}

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

type AssignmentTarget = { groupId: string | null; courseId: string | null }

/** Student ids an assignment is for: group members or enrolled students. */
export async function assignmentTargetStudentIds(a: AssignmentTarget): Promise<string[]> {
  if (a.groupId) {
    const members = await db.classGroupMember.findMany({ where: { groupId: a.groupId }, select: { studentId: true } })
    return members.map((m) => m.studentId)
  }
  if (a.courseId) {
    const enr = await db.enrollment.findMany({ where: { courseId: a.courseId }, select: { userId: true } })
    return enr.map((e) => e.userId)
  }
  return []
}

export async function isAssignmentTarget(a: AssignmentTarget, studentId: string): Promise<boolean> {
  if (a.groupId) {
    return !!(await db.classGroupMember.findUnique({
      where: { groupId_studentId: { groupId: a.groupId, studentId } },
      select: { id: true },
    }))
  }
  if (a.courseId) {
    return !!(await db.enrollment.findUnique({
      where: { userId_courseId: { userId: studentId, courseId: a.courseId } },
      select: { id: true },
    }))
  }
  return false
}

/** Whether the user may create homework for this target. */
export async function canTargetHomework(user: SessionUser, target: AssignmentTarget): Promise<boolean> {
  if (user.role === "ADMIN") return true
  if (target.groupId) return !!(await groupTeachingAccess(target.groupId, user))
  if (target.courseId) {
    const course = await db.course.findUnique({ where: { id: target.courseId }, select: { instructorId: true } })
    return course?.instructorId === user.id
  }
  return false
}

/** Whether the user may edit / grade an existing assignment. */
export async function canManageAssignment(
  user: SessionUser,
  a: AssignmentTarget & { teacherId: string }
): Promise<boolean> {
  if (user.role === "ADMIN" || a.teacherId === user.id) return true
  if (a.groupId) return canManageGroup(a.groupId, user)
  return false
}

/** Where-clause for assignments a teacher sees in their list. */
export async function teacherAssignmentScope(user: SessionUser) {
  if (user.role === "ADMIN") return {}
  const managed = await db.organizationMember.findMany({
    where: { userId: user.id, role: { in: ORG_MANAGER_ROLES } },
    select: { organizationId: true },
  })
  return {
    OR: [
      { teacherId: user.id },
      { group: { instructorId: user.id } },
      ...(managed.length ? [{ group: { organizationId: { in: managed.map((m) => m.organizationId) } } }] : []),
    ],
  }
}

/** Where-clause for assignments a student is a target of. */
export async function studentAssignmentScope(studentId: string) {
  const [groups, enrollments] = await Promise.all([
    db.classGroupMember.findMany({ where: { studentId }, select: { groupId: true } }),
    db.enrollment.findMany({ where: { userId: studentId }, select: { courseId: true } }),
  ])
  return {
    OR: [
      { groupId: { in: groups.map((g) => g.groupId) } },
      { groupId: null, courseId: { in: enrollments.map((e) => e.courseId) } },
    ],
  }
}

// ---------------------------------------------------------------------------
// Organization (school) access
// ---------------------------------------------------------------------------

export const SCHOOL_STAFF_ROLES: OrganizationRole[] = ["OWNER", "MANAGER", "TEACHER"]

/**
 * Loads the organization and the caller's access level. Throws 404 when the
 * org does not exist or the user is not staff, 403 when `manage` is required
 * but the user is only a teacher.
 */
export async function requireSchoolAccess(orgId: string, user: SessionUser, manage: boolean) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, type: true, logoUrl: true, primaryColor: true, address: true, phone: true },
  })
  if (!org) throw new ApiError(404, "Organization not found")
  let role: OrganizationRole | "ADMIN" | null = null
  if (user.role === "ADMIN") role = "ADMIN"
  else role = (await getOrgMembership(orgId, user.id))?.role ?? null
  if (!role || role === "STUDENT") throw new ApiError(404, "Organization not found")
  const canManage = role === "ADMIN" || ORG_MANAGER_ROLES.includes(role as OrganizationRole)
  if (manage && !canManage) throw new ApiError(403, "Only the school owner or managers can do this")
  return { org, role, canManage }
}

/** Ensures the class belongs to the organization. */
export async function requireOrgGroup(orgId: string, groupId: unknown) {
  if (typeof groupId !== "string" || !groupId) throw new ApiError(400, "groupId is required", { field: "groupId" })
  const group = await db.classGroup.findFirst({
    where: { id: groupId, organizationId: orgId },
    select: { id: true, name: true, instructorId: true, organizationId: true },
  })
  if (!group) throw new ApiError(404, "Class not found")
  return group
}

/** Ensures a user is staff (owner / manager / teacher) of the organization. */
export async function requireOrgTeacher(orgId: string, teacherId: unknown) {
  if (typeof teacherId !== "string" || !teacherId) throw new ApiError(400, "teacherId is required", { field: "teacherId" })
  const m = await getOrgMembership(orgId, teacherId)
  if (!m || !SCHOOL_STAFF_ROLES.includes(m.role)) {
    throw new ApiError(400, "The teacher is not a member of this school", { field: "teacherId", code: "not_org_teacher" })
  }
  return teacherId
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export type TimetableInput = {
  groupId: string
  teacherId: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type TimetableConflict = {
  type: "teacher" | "class"
  entryId: string
  groupId: string
  groupName: string
  subject: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

/**
 * Entries that clash with `entry` on the same day: the same class at an
 * overlapping time, or the same teacher anywhere (any class, any school) at
 * an overlapping time.
 */
export async function findTimetableConflicts(entry: TimetableInput, excludeId?: string): Promise<TimetableConflict[]> {
  const start = parseTime(entry.startTime)!
  const end = parseTime(entry.endTime)!
  const sameDay = await db.timetableEntry.findMany({
    where: {
      dayOfWeek: entry.dayOfWeek,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [{ groupId: entry.groupId }, ...(entry.teacherId ? [{ teacherId: entry.teacherId }] : [])],
    },
    include: { group: { select: { name: true } } },
  })
  const out: TimetableConflict[] = []
  for (const e of sameDay) {
    const s = parseTime(e.startTime)
    const en = parseTime(e.endTime)
    if (s === null || en === null || !rangesOverlap(start, end, s, en)) continue
    const base = {
      entryId: e.id,
      groupId: e.groupId,
      groupName: e.group.name,
      subject: e.subject,
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
    }
    if (e.groupId === entry.groupId) out.push({ type: "class", ...base })
    if (entry.teacherId && e.teacherId === entry.teacherId) out.push({ type: "teacher", ...base })
  }
  return out
}

/** Validates a timetable body. Returns the clean values or throws 400. */
export function validateTimetableBody(body: any) {
  const day = body?.dayOfWeek
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    throw new ApiError(400, "dayOfWeek must be 0..6", { field: "dayOfWeek" })
  }
  const start = parseTime(body?.startTime)
  const end = parseTime(body?.endTime)
  if (start === null) throw new ApiError(400, "startTime must be HH:MM", { field: "startTime" })
  if (end === null) throw new ApiError(400, "endTime must be HH:MM", { field: "endTime" })
  if (end <= start) throw new ApiError(400, "endTime must be after startTime", { field: "endTime", code: "end_before_start" })
  const subject = cleanText(body?.subject, 80)
  if (!subject) throw new ApiError(400, "subject is required", { field: "subject" })
  const room = cleanText(body?.room, 60)
  return {
    dayOfWeek: day as number,
    startTime: (body.startTime as string).trim(),
    endTime: (body.endTime as string).trim(),
    subject,
    room,
  }
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export const AUDIENCES = ["ALL", "STUDENTS", "PARENTS", "TEACHERS"] as const
export type Audience = (typeof AUDIENCES)[number]

/** Groups and organizations a student belongs to. */
export async function studentSchoolScope(studentId: string) {
  const [memberships, orgMembers] = await Promise.all([
    db.classGroupMember.findMany({
      where: { studentId },
      select: { groupId: true, group: { select: { organizationId: true } } },
    }),
    db.organizationMember.findMany({ where: { userId: studentId }, select: { organizationId: true } }),
  ])
  const groupIds = memberships.map((m) => m.groupId)
  const orgIds = new Set<string>(orgMembers.map((m) => m.organizationId))
  for (const m of memberships) if (m.group.organizationId) orgIds.add(m.group.organizationId)
  return { groupIds, orgIds: Array.from(orgIds) }
}

/** Announcements visible to a student (audience ALL or STUDENTS). */
export async function announcementsForStudent(studentId: string, take = 100) {
  const { groupIds, orgIds } = await studentSchoolScope(studentId)
  if (groupIds.length === 0 && orgIds.length === 0) return []
  return db.announcement.findMany({
    where: {
      audience: { in: ["ALL", "STUDENTS"] },
      OR: [
        ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
        ...(orgIds.length ? [{ organizationId: { in: orgIds }, groupId: null }] : []),
      ],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      author: { select: { id: true, name: true, image: true } },
      organization: { select: { id: true, name: true, logoUrl: true } },
      group: { select: { id: true, name: true } },
    },
  })
}

/** Recipients of an announcement (for in-app notifications). */
export async function announcementRecipients(a: {
  organizationId: string
  groupId: string | null
  audience: Audience
}): Promise<string[]> {
  const ids = new Set<string>()
  const wantStudents = a.audience === "ALL" || a.audience === "STUDENTS"
  const wantTeachers = a.audience === "ALL" || a.audience === "TEACHERS"
  const wantParents = a.audience === "ALL" || a.audience === "PARENTS"
  let studentIds: string[] = []
  if (a.groupId) {
    const members = await db.classGroupMember.findMany({ where: { groupId: a.groupId }, select: { studentId: true } })
    studentIds = members.map((m) => m.studentId)
  } else {
    const [orgStudents, classStudents] = await Promise.all([
      db.organizationMember.findMany({ where: { organizationId: a.organizationId, role: "STUDENT" }, select: { userId: true } }),
      db.classGroupMember.findMany({ where: { group: { organizationId: a.organizationId } }, select: { studentId: true } }),
    ])
    studentIds = Array.from(new Set([...orgStudents.map((m) => m.userId), ...classStudents.map((m) => m.studentId)]))
  }
  if (wantStudents) studentIds.forEach((id) => ids.add(id))
  if (wantParents && studentIds.length) {
    const links = await db.parentLink.findMany({
      where: { studentId: { in: studentIds }, status: "ACTIVE" },
      select: { parentId: true },
    })
    links.forEach((l) => ids.add(l.parentId))
  }
  if (wantTeachers) {
    if (a.groupId) {
      const [group, subs] = await Promise.all([
        db.classGroup.findUnique({ where: { id: a.groupId }, select: { instructorId: true } }),
        db.classSubject.findMany({ where: { groupId: a.groupId }, select: { teacherId: true } }),
      ])
      if (group) ids.add(group.instructorId)
      subs.forEach((s) => ids.add(s.teacherId))
    } else {
      const staff = await db.organizationMember.findMany({
        where: { organizationId: a.organizationId, role: { in: SCHOOL_STAFF_ROLES } },
        select: { userId: true },
      })
      staff.forEach((s) => ids.add(s.userId))
    }
  }
  return Array.from(ids)
}

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

export type ReportCard = {
  student: { id: string; name: string | null; email: string | null; image: string | null }
  subjects: { subject: string; percent: number | null; entries: number }[]
  overall: number | null
  attendance: { present: number; late: number; absent: number; excused: number; rate: number | null }
}

/**
 * Report cards of a class for a term.
 * - Subject average: weighted percentage of the term's grade entries.
 * - Overall: plain mean of the subject averages (each subject counts once).
 * - Attendance rate: (present + late) / (present + late + absent) of the
 *   class sessions held within the term; excused absences are not counted.
 */
export async function buildReportCards(
  groupId: string,
  term: { id: string; startsAt: Date; endsAt: Date }
): Promise<ReportCard[]> {
  const [members, entries, attendance, classSubjects] = await Promise.all([
    db.classGroupMember.findMany({
      where: { groupId },
      include: { student: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { student: { name: "asc" } },
    }),
    db.gradeEntry.findMany({
      where: { groupId, termId: term.id },
      select: { studentId: true, subject: true, score: true, maxScore: true, weight: true },
    }),
    db.attendanceRecord.findMany({
      where: { session: { groupId, startsAt: { gte: term.startsAt, lte: term.endsAt } } },
      select: { studentId: true, status: true },
    }),
    db.classSubject.findMany({ where: { groupId }, select: { subject: true } }),
  ])

  const subjectNames = new Set<string>(classSubjects.map((s) => s.subject))
  entries.forEach((e) => subjectNames.add(e.subject))
  const subjects = Array.from(subjectNames).sort((a, b) => a.localeCompare(b))

  return members.map(({ student }) => {
    const mine = entries.filter((e) => e.studentId === student.id)
    const subjectRows = subjects.map((subject) => {
      const marks = mine.filter((e) => e.subject === subject)
      return { subject, percent: weightedPercent(marks), entries: marks.length }
    })
    const counted = subjectRows.filter((s) => s.percent !== null) as { percent: number }[]
    const overall = counted.length ? round1(counted.reduce((s, r) => s + r.percent, 0) / counted.length) : null
    const att = { present: 0, late: 0, absent: 0, excused: 0, rate: null as number | null }
    for (const r of attendance) {
      if (r.studentId !== student.id) continue
      if (r.status === "PRESENT") att.present++
      else if (r.status === "LATE") att.late++
      else if (r.status === "ABSENT") att.absent++
      else att.excused++
    }
    const total = att.present + att.late + att.absent
    att.rate = total ? round1(((att.present + att.late) / total) * 100) : null
    return { student, subjects: subjectRows, overall, attendance: att }
  })
}

// ---------------------------------------------------------------------------
// Student grades
// ---------------------------------------------------------------------------

/** A student's gradebook marks grouped by term and subject, plus graded homework. */
export async function studentGrades(studentId: string) {
  const [entries, homework] = await Promise.all([
    db.gradeEntry.findMany({
      where: { studentId: studentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subject: true,
        title: true,
        score: true,
        maxScore: true,
        weight: true,
        createdAt: true,
        term: { select: { id: true, name: true, startsAt: true, isCurrent: true } },
        group: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    }),
    db.assignmentSubmission.findMany({
      where: { studentId: studentId, gradedAt: { not: null } },
      orderBy: { gradedAt: "desc" },
      select: {
        id: true,
        score: true,
        feedback: true,
        gradedAt: true,
        isLate: true,
        assignment: {
          select: {
            id: true,
            title: true,
            subject: true,
            maxScore: true,
            group: { select: { id: true, name: true } },
            course: { select: { id: true, titleAr: true, titleEn: true } },
          },
        },
      },
    }),
  ])

  type TermBucket = {
    term: { id: string; name: string; startsAt: Date; isCurrent: boolean } | null
    subjects: Map<string, typeof entries>
  }
  const terms = new Map<string, TermBucket>()
  for (const e of entries) {
    const key = e.term?.id ?? "none"
    if (!terms.has(key)) terms.set(key, { term: e.term, subjects: new Map() })
    const bucket = terms.get(key)!
    if (!bucket.subjects.has(e.subject)) bucket.subjects.set(e.subject, [])
    bucket.subjects.get(e.subject)!.push(e)
  }
  const termList = Array.from(terms.values())
    .sort((a, b) => (b.term?.startsAt.getTime() ?? 0) - (a.term?.startsAt.getTime() ?? 0))
    .map((b) => {
      const subjects = Array.from(b.subjects.entries())
        .sort(([a], [c]) => a.localeCompare(c))
        .map(([subject, marks]) => ({
          subject,
          average: weightedPercent(marks),
          marks: marks.map(({ term: _t, ...m }) => m),
        }))
      const avgs = subjects.map((s) => s.average).filter((v): v is number => v !== null)
      return {
        term: b.term,
        subjects,
        overall: avgs.length ? Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 10) / 10 : null,
      }
    })

  return {
    terms: termList,
    homework: homework.map((h) => ({ ...h, percent: weightedPercent([{ score: h.score ?? 0, maxScore: h.assignment.maxScore }]) })),
    homeworkAverage: weightedPercent(homework.map((h) => ({ score: h.score ?? 0, maxScore: h.assignment.maxScore }))),
  }
}
