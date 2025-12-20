import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Get platform analytics (Admin only)
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "30" // days

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(period))

    // Get overview stats
    const [
      totalUsers,
      newUsers,
      totalCourses,
      newCourses,
      totalEnrollments,
      newEnrollments,
      totalRevenue,
      periodRevenue,
      pendingWithdrawals,
      pendingWithdrawalsAmount,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: startDate } } }),
      db.course.count({ where: { status: "PUBLISHED" } }),
      db.course.count({
        where: { status: "PUBLISHED", publishedAt: { gte: startDate } },
      }),
      db.enrollment.count(),
      db.enrollment.count({ where: { enrolledAt: { gte: startDate } } }),
      db.purchase.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED" },
      }),
      db.purchase.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED", createdAt: { gte: startDate } },
      }),
      db.withdrawal.count({ where: { status: "PENDING" } }),
      db.withdrawal.aggregate({
        _sum: { amount: true },
        where: { status: "PENDING" },
      }),
    ])

    // Get revenue by day for chart
    const dailyRevenue = await db.purchase.groupBy({
      by: ["createdAt"],
      _sum: { amount: true },
      where: {
        status: "COMPLETED",
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "asc" },
    })

    // Process daily revenue for chart
    const revenueByDay: Record<string, number> = {}
    dailyRevenue.forEach((item) => {
      const date = item.createdAt.toISOString().split("T")[0]
      if (!revenueByDay[date]) {
        revenueByDay[date] = 0
      }
      revenueByDay[date] += item._sum.amount || 0
    })

    // Get enrollments by day
    const dailyEnrollments = await db.enrollment.groupBy({
      by: ["enrolledAt"],
      _count: true,
      where: { enrolledAt: { gte: startDate } },
      orderBy: { enrolledAt: "asc" },
    })

    const enrollmentsByDay: Record<string, number> = {}
    dailyEnrollments.forEach((item) => {
      const date = item.enrolledAt.toISOString().split("T")[0]
      if (!enrollmentsByDay[date]) {
        enrollmentsByDay[date] = 0
      }
      enrollmentsByDay[date] += item._count
    })

    // Top courses by enrollment
    const topCourses = await db.course.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        titleEn: true,
        titleAr: true,
        totalStudents: true,
        price: true,
        averageRating: true,
        instructor: {
          select: { name: true },
        },
      },
      orderBy: { totalStudents: "desc" },
      take: 10,
    })

    // Top instructors by students
    const topInstructors = await db.user.findMany({
      where: { role: "INSTRUCTOR" },
      select: {
        id: true,
        name: true,
        image: true,
        courses: {
          select: {
            totalStudents: true,
            averageRating: true,
          },
        },
        instructorProfile: {
          select: {
            totalEarnings: true,
          },
        },
      },
      take: 10,
    })

    const processedInstructors = topInstructors
      .map((instructor) => ({
        id: instructor.id,
        name: instructor.name,
        image: instructor.image,
        totalStudents: instructor.courses.reduce(
          (sum, c) => sum + c.totalStudents,
          0
        ),
        avgRating:
          instructor.courses.length > 0
            ? instructor.courses.reduce(
                (sum, c) => sum + (c.averageRating || 0),
                0
              ) / instructor.courses.length
            : 0,
        totalEarnings: instructor.instructorProfile?.totalEarnings || 0,
        coursesCount: instructor.courses.length,
      }))
      .sort((a, b) => b.totalStudents - a.totalStudents)

    // Recent activities
    const recentEnrollments = await db.enrollment.findMany({
      select: {
        id: true,
        enrolledAt: true,
        user: {
          select: { name: true, email: true },
        },
        course: {
          select: { titleEn: true, titleAr: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
      take: 10,
    })

    const recentPurchases = await db.purchase.findMany({
      where: { status: "COMPLETED" },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        user: {
          select: { name: true, email: true },
        },
        course: {
          select: { titleEn: true, titleAr: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    return NextResponse.json({
      overview: {
        totalUsers,
        newUsers,
        totalCourses,
        newCourses,
        totalEnrollments,
        newEnrollments,
        totalRevenue: totalRevenue._sum.amount || 0,
        periodRevenue: periodRevenue._sum.amount || 0,
        pendingWithdrawals,
        pendingWithdrawalsAmount: pendingWithdrawalsAmount._sum.amount || 0,
      },
      charts: {
        revenueByDay,
        enrollmentsByDay,
      },
      topCourses,
      topInstructors: processedInstructors,
      recentActivities: {
        enrollments: recentEnrollments,
        purchases: recentPurchases,
      },
    })
  } catch (error) {
    console.error("Get analytics error:", error)
    return NextResponse.json(
      { error: "Failed to get analytics" },
      { status: 500 }
    )
  }
}
