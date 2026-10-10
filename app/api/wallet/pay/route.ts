import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ApiError, apiErrorResponse, readJson } from "@/lib/api-error"
import { debitWallet, InsufficientBalanceError } from "@/lib/wallet"
import { isInClassGroup } from "@/lib/access"
import { activateTeacherSubscriptionInTx, logSubscriptionActivated } from "@/lib/teacher-subscription"
import { logActivity } from "@/lib/activity"

const split = (price: number, commissionRate: number | null | undefined) => {
  const platformShare = Number(((price * (commissionRate ?? 30)) / 100).toFixed(2))
  const instructorShare = Number((price - platformShare).toFixed(2))
  return { platformShare, instructorShare }
}

/** Serializes one user's wallet purchases so a double click cannot buy twice. */
async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"wallet-pay:" + userId}))`
}

// POST /api/wallet/pay { kind: "course" | "subscription", id }
// Pays a course (full price) or one month of a teacher subscription from the
// wallet balance, in one transaction. 402 { code: "insufficient_balance" }.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id
    const body = await readJson(request)
    const { kind, id } = body ?? {}
    if ((kind !== "course" && kind !== "subscription") || typeof id !== "string" || !id) {
      return NextResponse.json({ error: "kind (course | subscription) and id are required" }, { status: 400 })
    }

    if (kind === "course") {
      const course = await db.course.findFirst({
        where: { id, status: "PUBLISHED" },
        select: { id: true, slug: true, titleEn: true, titleAr: true, price: true, discountPrice: true, instructorId: true, classGroupId: true },
      })
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
      if (course.instructorId === userId) {
        return NextResponse.json({ error: "You cannot buy your own course", code: "own_course" }, { status: 400 })
      }
      const price =
        course.discountPrice !== null && course.discountPrice < course.price ? course.discountPrice : course.price
      if (!(price > 0)) {
        return NextResponse.json({ error: "This course is free; enroll directly", code: "free_course" }, { status: 400 })
      }
      if (!(await isInClassGroup(userId, course.classGroupId))) {
        return NextResponse.json({ error: "This course is only available to the teacher's group members", code: "group_only" }, { status: 403 })
      }
      const profile = await db.instructorProfile.findUnique({
        where: { userId: course.instructorId },
        select: { commissionRate: true },
      })
      const { platformShare, instructorShare } = split(price, profile?.commissionRate)

      const purchase = await db.$transaction(async (tx) => {
        await lockUser(tx, userId)
        const enrollment = await tx.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: course.id } },
        })
        if (enrollment && !enrollment.viaSubscription) {
          throw new ApiError(409, "Already enrolled", { code: "already_enrolled" })
        }
        const debit = await debitWallet(
          { userId, amount: price, reason: "course_purchase", reference: course.id, note: course.titleAr || course.titleEn },
          tx
        )
        const created = await tx.purchase.create({
          data: {
            userId,
            courseId: course.id,
            amount: price,
            currency: "EGP",
            provider: "WALLET",
            providerId: debit.id,
            status: "COMPLETED",
            instructorShare,
            platformShare,
          },
        })
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId, courseId: course.id } },
          update: { viaSubscription: false },
          create: { userId, courseId: course.id },
        })
        await tx.instructorProfile.upsert({
          where: { userId: course.instructorId },
          update: {
            pendingEarnings: { increment: instructorShare },
            totalEarnings: { increment: instructorShare },
          },
          create: { userId: course.instructorId, pendingEarnings: instructorShare, totalEarnings: instructorShare },
        })
        await tx.notification.create({
          data: {
            userId: course.instructorId,
            type: "PAYMENT_RECEIVED",
            title: "New course sale",
            message: `${session.user.name ?? "A student"} bought "${course.titleAr || course.titleEn}" from their wallet.`,
            link: "/instructor/earnings",
          },
        })
        return { ...created, balance: debit.balanceAfter }
      })

      await logActivity({
        actorId: userId,
        actorRole: session.user.role,
        action: "payment.completed",
        entityType: "course",
        entityId: course.id,
        summary: `Paid ${price} EGP from wallet for "${course.titleEn}"`,
        metadata: { purchaseId: purchase.id, provider: "WALLET" },
      })
      return NextResponse.json({ paid: true, kind, purchaseId: purchase.id, balance: purchase.balance, slug: course.slug }, { status: 201 })
    }

    // Subscription: one month of the teacher's monthly plan.
    if (id === userId) return NextResponse.json({ error: "You cannot subscribe to yourself" }, { status: 400 })
    const instructor = await db.user.findFirst({
      where: { id, role: "INSTRUCTOR", isBlocked: false },
      select: {
        id: true,
        name: true,
        instructorProfile: { select: { isApproved: true, subscriptionEnabled: true, monthlyPrice: true, commissionRate: true } },
      },
    })
    const profile = instructor?.instructorProfile
    if (!instructor || !profile?.isApproved || !profile.subscriptionEnabled) {
      return NextResponse.json({ error: "This instructor does not offer a subscription" }, { status: 404 })
    }
    const price = profile.monthlyPrice
    if (!(price > 0)) {
      return NextResponse.json({ error: "This subscription is free", code: "free_subscription" }, { status: 400 })
    }
    const { platformShare, instructorShare } = split(price, profile.commissionRate)

    const result = await db.$transaction(async (tx) => {
      await lockUser(tx, userId)
      const debit = await debitWallet(
        { userId, amount: price, reason: "subscription", reference: instructor.id, note: instructor.name ?? undefined },
        tx
      )
      const subscription = await activateTeacherSubscriptionInTx(tx, {
        studentId: userId,
        instructorId: instructor.id,
        amount: price,
        provider: "WALLET",
        providerId: debit.id,
        instructorShare,
        platformShare,
      })
      return { subscription, balance: debit.balanceAfter }
    })

    await logSubscriptionActivated(
      { studentId: userId, instructorId: instructor.id, amount: price, provider: "WALLET" },
      result.subscription
    )
    return NextResponse.json(
      { paid: true, kind, subscriptionId: result.subscription.id, endsAt: result.subscription.endsAt, balance: result.balance },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json(
        { error: "Insufficient wallet balance", code: "insufficient_balance", balance: error.balance, required: error.required },
        { status: 402 }
      )
    }
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Wallet pay error:", error)
    return NextResponse.json({ error: "Payment failed" }, { status: 500 })
  }
}
