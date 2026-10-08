import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  ArrowDownRight,
  BarChart3,
  BookOpen,
  Clock,
  DollarSign,
  History,
  Percent,
  Wallet,
} from "lucide-react"
import { PageHeader, SectionCard, StatCard } from "@/components/shared"
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
      titleEn: course.titleEn,
      titleAr: course.titleAr,
      students: course._count.enrollments,
      revenue: totalRevenue,
      earnings: instructorEarnings,
    }
  })

  const locale = await getLocale()
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Balances are stored in USD (same as the withdrawal and course tables below).
  const usd = (v: number) => `$${nf.format(v)}`

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title={t("earnings")}
        description={t("earningsDescription")}
        actions={
          !pendingWithdrawal && profile.pendingEarnings >= 50 ? (
            <WithdrawalRequestDialog availableBalance={profile.pendingEarnings} />
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("totalEarnings")}
          value={<span dir="ltr">{usd(profile.totalEarnings)}</span>}
          icon={DollarSign}
          hint={t("allTimeEarnings")}
        />
        <StatCard
          label={t("availableBalance")}
          value={<span dir="ltr">{usd(profile.pendingEarnings)}</span>}
          icon={Wallet}
          tone="success"
          hint={t("readyToWithdraw")}
        />
        <StatCard
          label={t("totalWithdrawn")}
          value={<span dir="ltr">{usd(totalWithdrawn)}</span>}
          icon={ArrowDownRight}
          tone="info"
          hint={`${completedWithdrawals.length} ${t("withdrawals")}`}
        />
        <StatCard
          label={t("platformFee")}
          value={`${profile.commissionRate}%`}
          icon={Percent}
          tone="warning"
          hint={`${t("youKeep")} ${100 - profile.commissionRate}%`}
        />
      </div>

      {pendingWithdrawal && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-amber-800 dark:text-amber-300"
        >
          <Clock className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">{t("pendingWithdrawal")}</p>
            <p className="text-sm opacity-90">
              <span dir="ltr">{usd(pendingWithdrawal.amount)}</span> · {t("processing")}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={BarChart3} title={t("earningsOverview")}>
          <EarningsChart />
        </SectionCard>
        <SectionCard icon={History} title={t("withdrawalHistory")}>
          <WithdrawalHistory withdrawals={withdrawals} />
        </SectionCard>
      </div>

      <SectionCard icon={BookOpen} title={t("earningsByCourse")}>
        <CourseEarningsTable courses={courseEarnings} />
      </SectionCard>
    </div>
  )
}
