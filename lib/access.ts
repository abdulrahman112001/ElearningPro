import { db } from "@/lib/db"

export const SUBSCRIPTION_DAYS = 30

/** The student's active subscription to an instructor, if any. */
export async function getActiveTeacherSubscription(studentId: string, instructorId: string) {
  return db.teacherSubscription.findFirst({
    where: {
      studentId,
      instructorId,
      status: "ACTIVE",
      endsAt: { gt: new Date() },
    },
    orderBy: { endsAt: "desc" },
  })
}

/** Whether the student belongs to the class group (always true when no group). */
export async function isInClassGroup(studentId: string, classGroupId: string | null | undefined) {
  if (!classGroupId) return true
  const member = await db.classGroupMember.findUnique({
    where: { groupId_studentId: { groupId: classGroupId, studentId } },
    select: { id: true },
  })
  return !!member
}

export type CourseAccess =
  | { allowed: true; via: "owner" | "admin" | "enrollment" | "subscription" }
  | { allowed: false; reason: "not_enrolled" | "group_only" | "subscription_expired" }

/**
 * Single source of truth for "can this user open this course's content".
 * A student with an active subscription to the course's instructor gets an
 * enrollment created on first access, so progress, quizzes and certificates
 * keep working through the regular enrollment record.
 */
export async function getCourseAccess(
  user: { id: string; role?: string | null },
  course: { id: string; instructorId: string; classGroupId?: string | null }
): Promise<CourseAccess> {
  if (course.instructorId === user.id) return { allowed: true, via: "owner" }
  if (user.role === "ADMIN") return { allowed: true, via: "admin" }

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true, viaSubscription: true },
  })
  if (enrollment && !enrollment.viaSubscription) return { allowed: true, via: "enrollment" }

  if (!(await isInClassGroup(user.id, course.classGroupId))) {
    return { allowed: false, reason: "group_only" }
  }

  const subscription = await getActiveTeacherSubscription(user.id, course.instructorId)
  if (subscription) {
    if (!enrollment) {
      await db.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        update: {},
        create: { userId: user.id, courseId: course.id, viaSubscription: true },
      })
    }
    return { allowed: true, via: "subscription" }
  }

  // A subscription enrollment whose subscription lapsed no longer opens content.
  if (enrollment?.viaSubscription) return { allowed: false, reason: "subscription_expired" }

  return { allowed: false, reason: "not_enrolled" }
}

/**
 * Students an instructor may contact or see results for: enrolled in one of
 * their courses, subscribed to them, or in one of their groups.
 */
export async function isStudentOfInstructor(studentId: string, instructorId: string) {
  const [enrollment, subscription, membership] = await Promise.all([
    db.enrollment.findFirst({
      where: { userId: studentId, course: { instructorId } },
      select: { id: true },
    }),
    db.teacherSubscription.findFirst({
      where: { studentId, instructorId, status: { in: ["ACTIVE", "EXPIRED"] } },
      select: { id: true },
    }),
    db.classGroupMember.findFirst({
      where: { studentId, group: { instructorId } },
      select: { id: true },
    }),
  ])
  return !!(enrollment || subscription || membership)
}
