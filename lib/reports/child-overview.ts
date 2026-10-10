import { db } from "@/lib/db"

const DAY_MS = 24 * 60 * 60 * 1000

export type HomeworkState = "graded" | "submitted" | "missing" | "pending"

/** The ids of the groups the student belongs to and the courses they are enrolled in. */
export async function getStudentScope(studentId: string) {
  const [groups, enrollments] = await Promise.all([
    db.classGroupMember.findMany({ where: { studentId }, select: { groupId: true } }),
    db.enrollment.findMany({ where: { userId: studentId }, select: { courseId: true } }),
  ])
  return {
    groupIds: groups.map((g) => g.groupId),
    courseIds: enrollments.map((e) => e.courseId),
  }
}

/**
 * Everything a parent sees on a child's page. Tables from features that may
 * not be in use yet (attendance, fees, homework, gradebook) simply come back
 * empty.
 */
export async function getChildOverview(studentId: string) {
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      points: true,
      currentStreak: true,
      lastActiveDate: true,
      createdAt: true,
      gradeLevel: { select: { nameAr: true, nameEn: true } },
    },
  })
  if (!student || student.role !== "STUDENT") return null

  const now = new Date()
  const { groupIds, courseIds } = await getStudentScope(studentId)
  const homeworkWindow = new Date(now.getTime() - 60 * DAY_MS)
  const attendanceWindow = new Date(now.getTime() - 90 * DAY_MS)

  const [
    enrollments,
    quizAttempts,
    attendanceRows,
    recentAbsences,
    fees,
    assignments,
    gradeEntries,
    alerts,
    upcomingSessions,
    upcomingLive,
  ] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: studentId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        progress: true,
        isCompleted: true,
        updatedAt: true,
        course: { select: { id: true, titleAr: true, titleEn: true, slug: true, thumbnail: true, totalLessons: true } },
      },
    }),
    db.quizAttempt.findMany({
      where: { userId: studentId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        score: true,
        passed: true,
        completedAt: true,
        needsGrading: true,
        quiz: { select: { title: true, titleAr: true, passingScore: true } },
      },
    }),
    db.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId, session: { startsAt: { gte: attendanceWindow } } },
      _count: { _all: true },
    }),
    db.attendanceRecord.findMany({
      where: { studentId, status: { in: ["ABSENT", "LATE"] } },
      orderBy: { session: { startsAt: "desc" } },
      take: 5,
      select: {
        id: true,
        status: true,
        session: { select: { title: true, startsAt: true, group: { select: { name: true } } } },
      },
    }),
    db.groupFee.findMany({
      where: { studentId, status: "DUE" },
      orderBy: { period: "asc" },
      select: { id: true, period: true, amount: true, group: { select: { name: true } } },
    }),
    groupIds.length || courseIds.length
      ? db.assignment.findMany({
          where: {
            OR: [
              ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
              ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
            ],
            AND: [{ OR: [{ dueAt: null }, { dueAt: { gte: homeworkWindow } }] }],
          },
          orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
          take: 15,
          select: {
            id: true,
            title: true,
            subject: true,
            dueAt: true,
            maxScore: true,
            submissions: {
              where: { studentId },
              select: { submittedAt: true, isLate: true, score: true, gradedAt: true },
            },
          },
        })
      : Promise.resolve([]),
    db.gradeEntry.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, subject: true, title: true, score: true, maxScore: true, createdAt: true },
    }),
    db.studentAlert.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, message: true, createdAt: true, sender: { select: { name: true } } },
    }),
    groupIds.length
      ? db.groupSession.findMany({
          where: { groupId: { in: groupIds }, startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          take: 5,
          select: { id: true, title: true, startsAt: true, mode: true, location: true, group: { select: { name: true } } },
        })
      : Promise.resolve([]),
    courseIds.length
      ? db.liveClass.findMany({
          where: { courseId: { in: courseIds }, status: { in: ["SCHEDULED", "LIVE"] }, scheduledAt: { gte: new Date(now.getTime() - 3 * 60 * 60 * 1000) } },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          select: { id: true, title: true, titleAr: true, scheduledAt: true, status: true, duration: true },
        })
      : Promise.resolve([]),
  ])

  const attendance = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 } as Record<string, number>
  for (const row of attendanceRows) attendance[row.status] = row._count._all
  const attendanceTotal = Object.values(attendance).reduce((a, b) => a + b, 0)
  const attendanceRate = attendanceTotal
    ? Math.round(((attendance.PRESENT + attendance.LATE) / attendanceTotal) * 100)
    : null

  const homework = assignments.map((a) => {
    const sub = a.submissions[0]
    let state: HomeworkState
    if (sub?.gradedAt && sub.score != null) state = "graded"
    else if (sub) state = "submitted"
    else if (a.dueAt && a.dueAt < now) state = "missing"
    else state = "pending"
    return {
      id: a.id,
      title: a.title,
      subject: a.subject,
      dueAt: a.dueAt,
      maxScore: a.maxScore,
      score: sub?.score ?? null,
      isLate: sub?.isLate ?? false,
      state,
    }
  })

  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((acc, e) => acc + e.progress, 0) / enrollments.length)
    : 0
  const avgQuiz = quizAttempts.length
    ? Math.round(quizAttempts.reduce((acc, q) => acc + q.score, 0) / quizAttempts.length)
    : null

  return {
    student,
    enrollments,
    quizAttempts,
    attendance: { counts: attendance, total: attendanceTotal, rate: attendanceRate, recentAbsences },
    fees: { items: fees, total: fees.reduce((acc, f) => acc + f.amount, 0) },
    homework,
    gradeEntries,
    alerts,
    upcoming: { sessions: upcomingSessions, liveClasses: upcomingLive },
    indicators: {
      courses: enrollments.length,
      avgProgress,
      avgQuiz,
      attendanceRate,
      feesDue: fees.reduce((acc, f) => acc + f.amount, 0),
      missingHomework: homework.filter((h) => h.state === "missing").length,
      alerts: alerts.length,
    },
  }
}

export type ChildOverview = NonNullable<Awaited<ReturnType<typeof getChildOverview>>>

/** Compact indicators for the parent's children cards. */
export async function getChildCardIndicators(studentId: string) {
  const now = new Date()
  const { groupIds, courseIds } = await getStudentScope(studentId)
  const since30 = new Date(now.getTime() - 30 * DAY_MS)
  const [enrollAgg, quizAgg, attendanceRows, feeAgg, missing, alerts] = await Promise.all([
    db.enrollment.aggregate({ where: { userId: studentId }, _avg: { progress: true }, _count: { _all: true } }),
    db.quizAttempt.aggregate({
      where: { userId: studentId, completedAt: { gte: since30 } },
      _avg: { score: true },
      _count: { _all: true },
    }),
    db.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId, session: { startsAt: { gte: since30 } } },
      _count: { _all: true },
    }),
    db.groupFee.aggregate({ where: { studentId, status: "DUE" }, _sum: { amount: true } }),
    groupIds.length || courseIds.length
      ? db.assignment.count({
          where: {
            OR: [
              ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
              ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
            ],
            dueAt: { lt: now, gte: since30 },
            submissions: { none: { studentId } },
          },
        })
      : Promise.resolve(0),
    db.studentAlert.count({ where: { studentId, createdAt: { gte: since30 } } }),
  ])
  let present = 0
  let total = 0
  for (const r of attendanceRows) {
    total += r._count._all
    if (r.status === "PRESENT" || r.status === "LATE") present += r._count._all
  }
  return {
    courses: enrollAgg._count._all,
    avgProgress: Math.round(enrollAgg._avg.progress ?? 0),
    avgQuiz: quizAgg._count._all ? Math.round(quizAgg._avg.score ?? 0) : null,
    attendanceRate: total ? Math.round((present / total) * 100) : null,
    feesDue: feeAgg._sum.amount ?? 0,
    missingHomework: missing,
    alerts,
  }
}
