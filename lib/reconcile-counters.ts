import { db } from "@/lib/db"

interface CounterDiff {
  entity: string
  id: string
  field: string
  before: number
  after: number
}

/**
 * Recomputes every denormalized counter from its source-of-truth tables and
 * corrects any drift. Safe to run repeatedly (idempotent) and safe to run
 * concurrently with normal traffic — each entity is updated independently.
 *
 * Covers (BUG-031):
 * - Course.totalStudents / averageRating / totalReviews
 * - InstructorProfile.totalEarnings / pendingEarnings / paidEarnings
 * - Coupon.usedCount
 */
export async function reconcileCounters(): Promise<CounterDiff[]> {
  const diffs: CounterDiff[] = []

  const courses = await db.course.findMany({
    select: { id: true, totalStudents: true, averageRating: true, totalReviews: true },
  })

  for (const course of courses) {
    const [enrollmentCount, reviewAgg] = await Promise.all([
      db.enrollment.count({ where: { courseId: course.id } }),
      db.review.aggregate({
        where: { courseId: course.id },
        _count: { _all: true },
        _avg: { rating: true },
      }),
    ])

    const totalReviews = reviewAgg._count._all
    const averageRating = totalReviews > 0 ? reviewAgg._avg.rating ?? 0 : 0

    if (
      course.totalStudents !== enrollmentCount ||
      course.totalReviews !== totalReviews ||
      Math.abs(course.averageRating - averageRating) > 0.001
    ) {
      if (course.totalStudents !== enrollmentCount) {
        diffs.push({
          entity: "Course",
          id: course.id,
          field: "totalStudents",
          before: course.totalStudents,
          after: enrollmentCount,
        })
      }
      if (course.totalReviews !== totalReviews) {
        diffs.push({
          entity: "Course",
          id: course.id,
          field: "totalReviews",
          before: course.totalReviews,
          after: totalReviews,
        })
      }
      if (Math.abs(course.averageRating - averageRating) > 0.001) {
        diffs.push({
          entity: "Course",
          id: course.id,
          field: "averageRating",
          before: course.averageRating,
          after: averageRating,
        })
      }

      await db.course.update({
        where: { id: course.id },
        data: { totalStudents: enrollmentCount, totalReviews, averageRating },
      })
    }
  }

  const instructorProfiles = await db.instructorProfile.findMany({
    select: {
      userId: true,
      totalEarnings: true,
      pendingEarnings: true,
      paidEarnings: true,
    },
  })

  for (const profile of instructorProfiles) {
    const [earningsAgg, paidAgg, inFlightAgg] = await Promise.all([
      db.purchase.aggregate({
        where: { status: "COMPLETED", course: { instructorId: profile.userId } },
        _sum: { instructorShare: true },
      }),
      db.withdrawal.aggregate({
        where: { userId: profile.userId, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      db.withdrawal.aggregate({
        where: { userId: profile.userId, status: { in: ["PENDING", "APPROVED"] } },
        _sum: { amount: true },
      }),
    ])

    const totalEarnings = earningsAgg._sum.instructorShare ?? 0
    const paidEarnings = paidAgg._sum.amount ?? 0
    const inFlight = inFlightAgg._sum.amount ?? 0
    const pendingEarnings = Math.max(0, totalEarnings - paidEarnings - inFlight)

    if (
      Math.abs(profile.totalEarnings - totalEarnings) > 0.001 ||
      Math.abs(profile.pendingEarnings - pendingEarnings) > 0.001 ||
      Math.abs(profile.paidEarnings - paidEarnings) > 0.001
    ) {
      if (Math.abs(profile.totalEarnings - totalEarnings) > 0.001) {
        diffs.push({
          entity: "InstructorProfile",
          id: profile.userId,
          field: "totalEarnings",
          before: profile.totalEarnings,
          after: totalEarnings,
        })
      }
      if (Math.abs(profile.pendingEarnings - pendingEarnings) > 0.001) {
        diffs.push({
          entity: "InstructorProfile",
          id: profile.userId,
          field: "pendingEarnings",
          before: profile.pendingEarnings,
          after: pendingEarnings,
        })
      }
      if (Math.abs(profile.paidEarnings - paidEarnings) > 0.001) {
        diffs.push({
          entity: "InstructorProfile",
          id: profile.userId,
          field: "paidEarnings",
          before: profile.paidEarnings,
          after: paidEarnings,
        })
      }

      await db.instructorProfile.update({
        where: { userId: profile.userId },
        data: { totalEarnings, pendingEarnings, paidEarnings },
      })
    }
  }

  const coupons = await db.coupon.findMany({ select: { id: true, usedCount: true } })

  for (const coupon of coupons) {
    const actualUsedCount = await db.purchase.count({
      where: { couponId: coupon.id, status: "COMPLETED" },
    })

    if (coupon.usedCount !== actualUsedCount) {
      diffs.push({
        entity: "Coupon",
        id: coupon.id,
        field: "usedCount",
        before: coupon.usedCount,
        after: actualUsedCount,
      })

      await db.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: actualUsedCount },
      })
    }
  }

  return diffs
}
