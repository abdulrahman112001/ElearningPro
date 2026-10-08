import type { Prisma, UserRole } from "@prisma/client"
import { db } from "@/lib/db"

/**
 * Action names recorded in the admin activity feed. Keep them stable: the
 * admin UI groups and translates them by this key.
 */
export type ActivityAction =
  | "user.registered"
  | "user.login"
  | "user.blocked"
  | "user.unblocked"
  | "user.role_changed"
  | "user.profile_updated"
  | "course.created"
  | "course.updated"
  | "course.published"
  | "course.submitted_for_review"
  | "course.approved"
  | "course.rejected"
  | "lesson.created"
  | "lesson.updated"
  | "enrollment.created"
  | "payment.started"
  | "payment.completed"
  | "subscription.started"
  | "subscription.activated"
  | "quiz.submitted"
  | "certificate.issued"
  | "question.asked"
  | "question.answered"
  | "message.sent"
  | "alert.sent"
  | "group.created"
  | "group.updated"
  | "group.deleted"
  | "group.member_added"
  | "group.member_removed"
  | "grade.created"
  | "grade.updated"
  | "grade.deleted"
  | "withdrawal.requested"
  | "withdrawal.processed"
  | "review.created"
  | "review.deleted"

interface LogInput {
  actorId?: string | null
  actorRole?: UserRole | string | null
  action: ActivityAction
  entityType?: string
  entityId?: string
  summary?: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Records an action for the admin activity feed. Never throws: auditing must
 * not break the user's request, so failures are only logged.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: (input.actorRole as UserRole) ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary?.slice(0, 500),
        metadata: input.metadata,
      },
    })
  } catch (error) {
    console.error("[activity] failed to log", input.action, error)
  }
}
