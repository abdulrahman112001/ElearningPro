import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity"

/**
 * Gamification: points, levels, daily streaks and badges.
 *
 * Every award is idempotent: PointTransaction is unique per
 * (userId, reason, referenceId), so replaying the same event (a lesson
 * completed twice, a retried request) never pays twice. The public hooks
 * (`onLessonCompleted`, ...) never throw: gamification must not break the
 * learning flow that triggered it.
 */

export const TIME_ZONE = "Africa/Cairo"

export const POINTS = {
  lesson_completed: 10,
  quiz_passed: 20,
  perfect_score: 15,
  course_completed: 100,
  assignment_submitted: 5,
  streak_7: 50,
  streak_30: 200,
} as const

export type PointReason =
  | "lesson_completed"
  | "quiz_passed"
  | "perfect_score"
  | "course_completed"
  | "assignment_submitted"
  | "streak_bonus"

export const STREAK_MILESTONES = [
  { days: 7, points: POINTS.streak_7, badge: "streak_7" },
  { days: 30, points: POINTS.streak_30, badge: "streak_30" },
] as const

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

const LEVEL_FACTOR = 50

/** Points needed to reach a level (level 1 starts at 0). */
export function pointsForLevel(level: number) {
  return LEVEL_FACTOR * Math.max(level - 1, 0) ** 2
}

export interface LevelInfo {
  level: number
  points: number
  /** Points at which the current level started. */
  levelStart: number
  /** Points at which the next level starts. */
  nextLevelAt: number
  /** Points still needed for the next level. */
  toNext: number
  /** 0-100 progress through the current level. */
  progress: number
}

/** level = floor(sqrt(points / 50)) + 1 → 0, 50, 200, 450, 800 ... */
export function levelFromPoints(points: number): LevelInfo {
  const p = Math.max(0, Math.floor(points || 0))
  const level = Math.floor(Math.sqrt(p / LEVEL_FACTOR)) + 1
  const levelStart = pointsForLevel(level)
  const nextLevelAt = pointsForLevel(level + 1)
  const span = nextLevelAt - levelStart
  return {
    level,
    points: p,
    levelStart,
    nextLevelAt,
    toNext: nextLevelAt - p,
    progress: span > 0 ? Math.min(100, Math.round(((p - levelStart) / span) * 100)) : 0,
  }
}

// ---------------------------------------------------------------------------
// Cairo calendar helpers
// ---------------------------------------------------------------------------

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** "YYYY-MM-DD" of the instant in Cairo. */
export function cairoDateKey(date: Date) {
  return dayFormatter.format(date)
}

/** Whole days since 1970-01-01 of the Cairo calendar date of the instant. */
export function cairoDayNumber(date: Date) {
  const [y, m, d] = cairoDateKey(date).split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Minutes Cairo is ahead of UTC at the given instant. */
function cairoOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"))
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000)
}

/** UTC instant of 00:00 Cairo time on the given Cairo day number. */
function cairoMidnight(dayNumber: number) {
  const utcMidnight = dayNumber * 86_400_000
  let instant = utcMidnight - cairoOffsetMinutes(new Date(utcMidnight)) * 60_000
  // Re-check once in case a DST switch falls between the guess and the result.
  instant = utcMidnight - cairoOffsetMinutes(new Date(instant)) * 60_000
  return new Date(instant)
}

/** Start of the current leaderboard week: Saturday 00:00 Cairo time. */
export function weekStart(now: Date = new Date()) {
  const day = cairoDayNumber(now)
  // 1970-01-01 was a Thursday (0 = Sunday ... 6 = Saturday).
  const dow = (((day + 4) % 7) + 7) % 7
  const sinceSaturday = (dow + 1) % 7
  return cairoMidnight(day - sinceSaturday)
}

// ---------------------------------------------------------------------------
// Badge catalog
// ---------------------------------------------------------------------------

export interface BadgeDef {
  key: string
  nameAr: string
  nameEn: string
  descriptionAr: string
  descriptionEn: string
  icon: string
}

export const BADGES: BadgeDef[] = [
  { key: "first_lesson", nameAr: "الخطوة الأولى", nameEn: "First step", descriptionAr: "أكملت أول درس لك", descriptionEn: "Completed your first lesson", icon: "Footprints" },
  { key: "lessons_10", nameAr: "متعلم نشيط", nameEn: "Keen learner", descriptionAr: "أكملت 10 دروس", descriptionEn: "Completed 10 lessons", icon: "BookOpen" },
  { key: "lessons_50", nameAr: "نهم المعرفة", nameEn: "Knowledge seeker", descriptionAr: "أكملت 50 درسًا", descriptionEn: "Completed 50 lessons", icon: "Library" },
  { key: "first_course", nameAr: "أول كورس", nameEn: "First course", descriptionAr: "أنهيت أول كورس كامل", descriptionEn: "Finished your first course", icon: "GraduationCap" },
  { key: "courses_5", nameAr: "خمسة كورسات", nameEn: "Five courses", descriptionAr: "أنهيت 5 كورسات", descriptionEn: "Finished 5 courses", icon: "Award" },
  { key: "quiz_perfect", nameAr: "الدرجة النهائية", nameEn: "Perfect score", descriptionAr: "حصلت على 100% في اختبار", descriptionEn: "Scored 100% on a quiz", icon: "Target" },
  { key: "quiz_master", nameAr: "أستاذ الاختبارات", nameEn: "Quiz master", descriptionAr: "حصلت على 100% في 5 اختبارات مختلفة", descriptionEn: "Scored 100% on 5 different quizzes", icon: "Brain" },
  { key: "streak_7", nameAr: "أسبوع متواصل", nameEn: "7-day streak", descriptionAr: "تعلمت 7 أيام متتالية", descriptionEn: "Learned 7 days in a row", icon: "Flame" },
  { key: "streak_30", nameAr: "شهر من الالتزام", nameEn: "30-day streak", descriptionAr: "تعلمت 30 يومًا متتاليًا", descriptionEn: "Learned 30 days in a row", icon: "Zap" },
  { key: "homework_hero", nameAr: "بطل الواجبات", nameEn: "Homework hero", descriptionAr: "سلّمت 10 واجبات", descriptionEn: "Submitted 10 assignments", icon: "ClipboardCheck" },
  { key: "top_of_group", nameAr: "الأول في المجموعة", nameEn: "Top of the group", descriptionAr: "تصدرت مجموعتك في نقاط الأسبوع", descriptionEn: "Ranked first in your group this week", icon: "Crown" },
]

let catalogReady: Promise<void> | null = null

/** Lazily upserts the badge catalog (once per server process). */
export function ensureBadges(): Promise<void> {
  if (!catalogReady) {
    catalogReady = (async () => {
      for (const b of BADGES) {
        await db.badge.upsert({
          where: { key: b.key },
          update: { nameAr: b.nameAr, nameEn: b.nameEn, descriptionAr: b.descriptionAr, descriptionEn: b.descriptionEn, icon: b.icon },
          create: b,
        })
      }
    })().catch((error) => {
      catalogReady = null
      throw error
    })
  }
  return catalogReady
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/**
 * Awards points once per (userId, reason, referenceId). Returns true when the
 * points were added, false when this award already existed.
 */
export async function awardPoints(input: {
  userId: string
  reason: PointReason
  referenceId: string
  points: number
}): Promise<boolean> {
  const points = Math.round(input.points)
  if (!points) return false
  try {
    await db.$transaction([
      db.pointTransaction.create({
        data: { userId: input.userId, reason: input.reason, referenceId: input.referenceId, points },
      }),
      db.user.update({ where: { id: input.userId }, data: { points: { increment: points } } }),
    ])
    return true
  } catch (error) {
    if (isUniqueViolation(error)) return false
    throw error
  }
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export interface StreakResult {
  currentStreak: number
  longestStreak: number
  changed: boolean
  bonusPoints: number
}

/**
 * Records today's learning activity (Cairo calendar days): same day is a
 * no-op, the next day extends the streak, a gap restarts it at 1. Reaching
 * 7 / 30 days pays a one-off bonus for that run.
 */
export async function touchStreak(userId: string, now: Date = new Date()): Promise<StreakResult> {
  // Two attempts: the update is conditional on the value we read, so a
  // concurrent request can't increment the same day twice.
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, longestStreak: true, lastActiveDate: true },
    })
    if (!user) return { currentStreak: 0, longestStreak: 0, changed: false, bonusPoints: 0 }

    const today = cairoDayNumber(now)
    const last = user.lastActiveDate ? cairoDayNumber(user.lastActiveDate) : null

    if (last !== null && last >= today && user.currentStreak > 0) {
      return { currentStreak: user.currentStreak, longestStreak: user.longestStreak, changed: false, bonusPoints: 0 }
    }

    const current = last !== null && last === today - 1 ? user.currentStreak + 1 : 1
    const longest = Math.max(user.longestStreak, current)

    const updated = await db.user.updateMany({
      where: { id: userId, lastActiveDate: user.lastActiveDate },
      data: { currentStreak: current, longestStreak: longest, lastActiveDate: now },
    })
    if (updated.count === 0) continue

    let bonusPoints = 0
    for (const m of STREAK_MILESTONES) {
      if (current === m.days) {
        // One bonus per run: keyed by the day the milestone was reached.
        const paid = await awardPoints({
          userId,
          reason: "streak_bonus",
          referenceId: `${m.days}:${cairoDateKey(now)}`,
          points: m.points,
        })
        if (paid) bonusPoints += m.points
      }
    }
    return { currentStreak: current, longestStreak: longest, changed: true, bonusPoints }
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { currentStreak: true, longestStreak: true } })
  return { currentStreak: user?.currentStreak ?? 0, longestStreak: user?.longestStreak ?? 0, changed: false, bonusPoints: 0 }
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** Weekly points per user since Saturday, for the given users. */
export async function weeklyPoints(userIds: string[], since: Date = weekStart()) {
  if (userIds.length === 0) return new Map<string, number>()
  const rows = await db.pointTransaction.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, createdAt: { gte: since } },
    _sum: { points: true },
  })
  return new Map(rows.map((r) => [r.userId, r._sum.points ?? 0]))
}

async function isTopOfAnyGroup(userId: string) {
  const memberships = await db.classGroupMember.findMany({
    where: { studentId: userId },
    select: { group: { select: { members: { select: { studentId: true } } } } },
  })
  for (const m of memberships) {
    const ids = m.group.members.map((x) => x.studentId)
    if (ids.length < 2) continue
    const sums = await weeklyPoints(ids)
    const mine = sums.get(userId) ?? 0
    if (mine <= 0) continue
    if (ids.every((id) => id === userId || (sums.get(id) ?? 0) < mine)) return true
  }
  return false
}

/** Awards every badge whose condition is met. Returns the newly awarded keys. */
export async function checkBadges(userId: string): Promise<string[]> {
  await ensureBadges()
  const [owned, user] = await Promise.all([
    db.userBadge.findMany({ where: { userId }, select: { badge: { select: { key: true } } } }),
    db.user.findUnique({ where: { id: userId }, select: { longestStreak: true, role: true } }),
  ])
  if (!user) return []
  const have = new Set(owned.map((o) => o.badge.key))
  const missing = (keys: string[]) => keys.some((k) => !have.has(k))
  const earned: string[] = []

  if (missing(["first_lesson", "lessons_10", "lessons_50"])) {
    const n = await db.progress.count({ where: { userId, isCompleted: true } })
    if (n >= 1) earned.push("first_lesson")
    if (n >= 10) earned.push("lessons_10")
    if (n >= 50) earned.push("lessons_50")
  }
  if (missing(["first_course", "courses_5"])) {
    const n = await db.enrollment.count({ where: { userId, isCompleted: true } })
    if (n >= 1) earned.push("first_course")
    if (n >= 5) earned.push("courses_5")
  }
  if (missing(["quiz_perfect", "quiz_master"])) {
    const perfect = await db.quizAttempt.groupBy({
      by: ["quizId"],
      where: { userId, score: { gte: 100 }, needsGrading: false },
    })
    if (perfect.length >= 1) earned.push("quiz_perfect")
    if (perfect.length >= 5) earned.push("quiz_master")
  }
  if (user.longestStreak >= 7) earned.push("streak_7")
  if (user.longestStreak >= 30) earned.push("streak_30")
  if (!have.has("homework_hero")) {
    const n = await db.assignmentSubmission.count({ where: { studentId: userId } })
    if (n >= 10) earned.push("homework_hero")
  }
  if (!have.has("top_of_group") && (await isTopOfAnyGroup(userId))) earned.push("top_of_group")

  const fresh = earned.filter((k) => !have.has(k))
  if (fresh.length === 0) return []

  const badges = await db.badge.findMany({ where: { key: { in: fresh } } })
  const awarded: string[] = []
  for (const badge of badges) {
    try {
      await db.userBadge.create({ data: { userId, badgeId: badge.id } })
      awarded.push(badge.key)
      await db.notification.create({
        data: {
          userId,
          type: "SYSTEM",
          title: `🏅 ${badge.nameAr} | ${badge.nameEn}`,
          message: `${badge.descriptionAr ?? ""} — ${badge.descriptionEn ?? ""}`,
          link: "/student/achievements",
        },
      })
      await logActivity({
        actorId: userId,
        actorRole: user.role,
        action: "badge.awarded",
        entityType: "badge",
        entityId: badge.id,
        summary: `Badge "${badge.nameEn}" awarded`,
        metadata: { key: badge.key },
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
  }
  return awarded
}

// ---------------------------------------------------------------------------
// Hooks (never throw)
// ---------------------------------------------------------------------------

export interface GamificationResult {
  points: number
  badges: string[]
  streak?: number
}

const EMPTY: GamificationResult = { points: 0, badges: [] }

async function safely(label: string, fn: () => Promise<GamificationResult>): Promise<GamificationResult> {
  try {
    return await fn()
  } catch (error) {
    console.error(`[gamification] ${label} failed`, error)
    return EMPTY
  }
}

async function withStreak(userId: string, points: number): Promise<GamificationResult> {
  const streak = await touchStreak(userId)
  const badges = await checkBadges(userId)
  return { points: points + streak.bonusPoints, badges, streak: streak.currentStreak }
}

/** Learning activity without points (e.g. watching): keeps the streak alive. */
export function onLearningActivity(userId: string) {
  return safely("activity", () => withStreak(userId, 0))
}

export function onLessonCompleted(userId: string, lessonId: string) {
  return safely("lesson", async () => {
    const paid = await awardPoints({ userId, reason: "lesson_completed", referenceId: lessonId, points: POINTS.lesson_completed })
    return withStreak(userId, paid ? POINTS.lesson_completed : 0)
  })
}

/**
 * A finished quiz attempt. Points are paid once per quiz (not per attempt),
 * so retaking a passed quiz can't farm points.
 */
export function onQuizSubmitted(userId: string, attemptId: string, scorePercent: number, passed: boolean) {
  return safely("quiz", async () => {
    const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId }, select: { quizId: true, userId: true } })
    if (!attempt || attempt.userId !== userId) return EMPTY
    let points = 0
    if (passed && (await awardPoints({ userId, reason: "quiz_passed", referenceId: attempt.quizId, points: POINTS.quiz_passed }))) {
      points += POINTS.quiz_passed
    }
    if (scorePercent >= 100 && (await awardPoints({ userId, reason: "perfect_score", referenceId: attempt.quizId, points: POINTS.perfect_score }))) {
      points += POINTS.perfect_score
    }
    return withStreak(userId, points)
  })
}

export function onCourseCompleted(userId: string, courseId: string) {
  return safely("course", async () => {
    const paid = await awardPoints({ userId, reason: "course_completed", referenceId: courseId, points: POINTS.course_completed })
    const badges = await checkBadges(userId)
    return { points: paid ? POINTS.course_completed : 0, badges }
  })
}

export function onAssignmentSubmitted(userId: string, assignmentId: string) {
  return safely("assignment", async () => {
    const paid = await awardPoints({ userId, reason: "assignment_submitted", referenceId: assignmentId, points: POINTS.assignment_submitted })
    return withStreak(userId, paid ? POINTS.assignment_submitted : 0)
  })
}

// ---------------------------------------------------------------------------
// Leaderboards (names + avatars only, never emails)
// ---------------------------------------------------------------------------

export type LeaderboardPeriod = "week" | "all"

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string | null
  image: string | null
  points: number
  level: number
}

export const LEADERBOARD_LIMIT = 50

/** Competition ranking (1, 1, 3) by points, then name for a stable order. */
function rank(rows: Omit<LeaderboardEntry, "rank">[]): LeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || (a.name ?? "").localeCompare(b.name ?? ""))
  let prev = Number.NaN
  let prevRank = 0
  return sorted.map((row, i) => {
    const r = row.points === prev ? prevRank : i + 1
    prev = row.points
    prevRank = r
    return { ...row, rank: r }
  })
}

/** Ranks a known set of students (a group or a course), zero-point members included. */
export async function rankUsers(userIds: string[], period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
  const ids = Array.from(new Set(userIds))
  if (ids.length === 0) return []
  const users = await db.user.findMany({
    where: { id: { in: ids }, role: "STUDENT" },
    select: { id: true, name: true, image: true, points: true },
  })
  const weekly = period === "week" ? await weeklyPoints(users.map((u) => u.id)) : null
  return rank(
    users.map((u) => ({
      userId: u.id,
      name: u.name,
      image: u.image,
      points: weekly ? weekly.get(u.id) ?? 0 : u.points,
      level: levelFromPoints(u.points).level,
    }))
  )
}

/**
 * Platform-wide top students. Returns the top entries plus the viewer's own
 * entry (with its true rank) even when they are outside the top.
 */
export async function platformLeaderboard(
  period: LeaderboardPeriod,
  viewerId: string,
  limit = LEADERBOARD_LIMIT
): Promise<{ entries: LeaderboardEntry[]; me: LeaderboardEntry | null }> {
  const select = { id: true, name: true, image: true, points: true } as const
  if (period === "all") {
    const top = await db.user.findMany({
      where: { role: "STUDENT", points: { gt: 0 } },
      orderBy: [{ points: "desc" }, { name: "asc" }],
      take: limit,
      select,
    })
    const entries = rank(top.map((u) => ({ userId: u.id, name: u.name, image: u.image, points: u.points, level: levelFromPoints(u.points).level })))
    let me = entries.find((e) => e.userId === viewerId) ?? null
    if (!me) {
      const viewer = await db.user.findUnique({ where: { id: viewerId }, select: { ...select, role: true } })
      if (viewer && viewer.role === "STUDENT") {
        const ahead = await db.user.count({ where: { role: "STUDENT", points: { gt: viewer.points } } })
        me = { userId: viewer.id, name: viewer.name, image: viewer.image, points: viewer.points, level: levelFromPoints(viewer.points).level, rank: ahead + 1 }
      }
    }
    return { entries, me }
  }

  const since = weekStart()
  const sums = await db.pointTransaction.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: since }, user: { role: "STUDENT" } },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  })
  const users = await db.user.findMany({ where: { id: { in: sums.map((s) => s.userId) } }, select })
  const byId = new Map(users.map((u) => [u.id, u]))
  const entries = rank(
    sums
      .filter((s) => byId.has(s.userId) && (s._sum.points ?? 0) > 0)
      .map((s) => {
        const u = byId.get(s.userId)!
        return { userId: u.id, name: u.name, image: u.image, points: s._sum.points ?? 0, level: levelFromPoints(u.points).level }
      })
  )
  let me = entries.find((e) => e.userId === viewerId) ?? null
  if (!me) {
    const viewer = await db.user.findUnique({ where: { id: viewerId }, select: { ...select, role: true } })
    if (viewer && viewer.role === "STUDENT") {
      const mine = (await weeklyPoints([viewer.id], since)).get(viewer.id) ?? 0
      const ahead = await db.pointTransaction.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: since }, user: { role: "STUDENT" } },
        _sum: { points: true },
        having: { points: { _sum: { gt: mine } } },
      })
      me = { userId: viewer.id, name: viewer.name, image: viewer.image, points: mine, level: levelFromPoints(viewer.points).level, rank: ahead.length + 1 }
    }
  }
  return { entries, me }
}

/** Student ids of a group's members. */
export async function groupStudentIds(groupId: string) {
  const rows = await db.classGroupMember.findMany({ where: { groupId }, select: { studentId: true } })
  return rows.map((r) => r.studentId)
}

/** Student ids enrolled in a course. */
export async function courseStudentIds(courseId: string) {
  const rows = await db.enrollment.findMany({ where: { courseId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}
