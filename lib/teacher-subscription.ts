import type { PaymentProvider, Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { SUBSCRIPTION_DAYS } from "@/lib/access"
import { logActivity } from "@/lib/activity"

interface ActivateInput {
  studentId: string
  instructorId: string
  amount: number
  currency?: string
  provider?: PaymentProvider | null
  providerId?: string | null
  instructorShare?: number
  platformShare?: number
}

/**
 * Activates (or extends by one period) a student's subscription to an
 * instructor. A renewal before expiry stacks on the current end date. Runs in
 * one transaction with the instructor's earnings, so a webhook retry cannot
 * credit twice (providerId is unique).
 */
export async function activateTeacherSubscription(input: ActivateInput) {
  const now = new Date()
  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.teacherSubscription.findFirst({
      where: {
        studentId: input.studentId,
        instructorId: input.instructorId,
        status: "ACTIVE",
        endsAt: { gt: now },
      },
      orderBy: { endsAt: "desc" },
    })
    const startsAt = current?.endsAt ?? now
    const endsAt = new Date(startsAt.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000)

    const subscription = await tx.teacherSubscription.create({
      data: {
        studentId: input.studentId,
        instructorId: input.instructorId,
        status: "ACTIVE",
        amount: input.amount,
        currency: input.currency ?? "EGP",
        provider: input.provider ?? null,
        providerId: input.providerId ?? null,
        instructorShare: input.instructorShare ?? 0,
        platformShare: input.platformShare ?? 0,
        startsAt,
        endsAt,
      },
    })

    const share = input.instructorShare ?? 0
    if (share > 0) {
      await tx.instructorProfile.upsert({
        where: { userId: input.instructorId },
        update: {
          pendingEarnings: { increment: share },
          totalEarnings: { increment: share },
        },
        create: { userId: input.instructorId, pendingEarnings: share, totalEarnings: share },
      })
    }

    await tx.notification.create({
      data: {
        userId: input.instructorId,
        type: "NEW_SUBSCRIPTION",
        title: "New subscriber",
        message: "A student subscribed to your courses.",
        link: "/instructor/subscribers",
      },
    })

    return subscription
  })

  await logActivity({
    actorId: input.studentId,
    actorRole: "STUDENT",
    action: "subscription.activated",
    entityType: "teacherSubscription",
    entityId: result.id,
    summary: `Subscription active until ${result.endsAt?.toISOString().slice(0, 10)}`,
    metadata: { instructorId: input.instructorId, amount: input.amount },
  })

  return result
}

/** Marks subscriptions whose period ended as EXPIRED (cheap, idempotent). */
export async function expireLapsedSubscriptions() {
  return db.teacherSubscription.updateMany({
    where: { status: "ACTIVE", endsAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  })
}
