import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Get instructor earnings summary
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get instructor profile
    const profile = await db.instructorProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!profile) {
      return NextResponse.json(
        { error: "Instructor profile not found" },
        { status: 404 }
      )
    }

    // Get all purchases for instructor's courses
    const purchases = await db.purchase.findMany({
      where: {
        course: {
          instructorId: session.user.id,
        },
        status: "COMPLETED",
      },
      include: {
        course: {
          select: {
            id: true,
            titleEn: true,
            titleAr: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Calculate earnings by course
    const courseEarnings: Record<
      string,
      {
        titleEn: string
        titleAr: string | null
        amount: number
        students: number
      }
    > = {}

    for (const purchase of purchases) {
      const courseId = purchase.courseId
      const instructorShare =
        purchase.amount * (1 - profile.commissionRate / 100)

      if (!courseEarnings[courseId]) {
        courseEarnings[courseId] = {
          titleEn: purchase.course.titleEn,
          titleAr: purchase.course.titleAr,
          amount: 0,
          students: 0,
        }
      }

      courseEarnings[courseId].amount += instructorShare
      courseEarnings[courseId].students += 1
    }

    // Get withdrawals
    const withdrawals = await db.withdrawal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    const completedWithdrawals = withdrawals.filter(
      (w) => w.status === "COMPLETED"
    )
    const totalWithdrawn = completedWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0
    )

    // Get monthly earnings for chart
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyPurchases = await db.purchase.groupBy({
      by: ["createdAt"],
      where: {
        course: {
          instructorId: session.user.id,
        },
        status: "COMPLETED",
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      _sum: {
        amount: true,
      },
    })

    return NextResponse.json({
      summary: {
        totalEarnings: profile.totalEarnings,
        pendingEarnings: profile.pendingEarnings,
        availableBalance: profile.pendingEarnings,
        totalWithdrawn,
        commissionRate: profile.commissionRate,
      },
      courseEarnings: Object.entries(courseEarnings).map(([id, data]) => ({
        courseId: id,
        ...data,
      })),
      recentPurchases: purchases.slice(0, 10).map((p) => ({
        id: p.id,
        courseTitle: p.course.titleEn,
        courseTitleAr: p.course.titleAr,
        amount: p.amount * (1 - profile.commissionRate / 100),
        date: p.createdAt,
      })),
      withdrawals,
    })
  } catch (error) {
    console.error("Get earnings error:", error)
    return NextResponse.json(
      { error: "Failed to get earnings" },
      { status: 500 }
    )
  }
}
