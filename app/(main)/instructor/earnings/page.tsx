import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  DollarSign,
  TrendingUp,
  Wallet,
  ArrowDownRight,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EarningsChart } from "@/components/instructor/earnings-chart"
import { WithdrawalRequestDialog } from "@/components/instructor/withdrawal-request-dialog"
import { WithdrawalHistory } from "@/components/instructor/withdrawal-history"
import { CourseEarningsTable } from "@/components/instructor/course-earnings-table"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("earnings"),
  }
}

export default async function InstructorEarningsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/")
  }

  const t = await getTranslations("instructor")

  // Get instructor profile
  const profile = await db.instructorProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!profile) {
    // Create profile if doesn't exist
    await db.instructorProfile.create({
      data: {
        userId: session.user.id,
      },
    })
    redirect("/instructor/earnings")
  }

  // Get withdrawals
  const withdrawals = await db.withdrawal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  const pendingWithdrawal = withdrawals.find((w) => w.status === "PENDING")
  const completedWithdrawals = withdrawals.filter(
    (w) => w.status === "COMPLETED"
  )
  const totalWithdrawn = completedWithdrawals.reduce(
    (sum, w) => sum + w.amount,
    0
  )

  // Get course earnings
  const courses = await db.course.findMany({
    where: { instructorId: session.user.id },
    include: {
      purchases: {
        where: { status: "COMPLETED" },
        select: { amount: true },
      },
      _count: {
        select: { enrollments: true },
      },
    },
  })

  const courseEarnings = courses.map((course) => {
    const totalRevenue = course.purchases.reduce((sum, p) => sum + p.amount, 0)
    const instructorEarnings = totalRevenue * (1 - profile.commissionRate / 100)
    return {
      id: course.id,
      title: course.titleEn,
      titleAr: course.titleAr,
      students: course._count.enrollments,
      revenue: totalRevenue,
      earnings: instructorEarnings,
    }
  })

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("earnings")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("earningsDescription")}
          </p>
        </div>

        {!pendingWithdrawal && profile.pendingEarnings >= 50 && (
          <WithdrawalRequestDialog availableBalance={profile.pendingEarnings} />
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalEarnings")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${profile.totalEarnings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("allTimeEarnings")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("availableBalance")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${profile.pendingEarnings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("readyToWithdraw")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalWithdrawn")}
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalWithdrawn.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {completedWithdrawals.length} {t("withdrawals")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("platformFee")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.commissionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {t("youKeep")} {100 - profile.commissionRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Withdrawal Alert */}
      {pendingWithdrawal && (
        <Card className="mb-8 border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-4 py-4">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">
                {t("pendingWithdrawal")}
              </p>
              <p className="text-sm text-yellow-700">
                ${pendingWithdrawal.amount.toFixed(2)} - {t("processing")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Earnings Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("earningsOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <EarningsChart />
          </CardContent>
        </Card>

        {/* Withdrawal History */}
        <Card>
          <CardHeader>
            <CardTitle>{t("withdrawalHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <WithdrawalHistory withdrawals={withdrawals} />
          </CardContent>
        </Card>
      </div>

      {/* Course Earnings Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t("earningsByCourse")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseEarningsTable courses={courseEarnings} />
        </CardContent>
      </Card>
    </div>
  )
}
