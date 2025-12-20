import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { WithdrawalsTable } from "@/components/admin/withdrawals-table"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("withdrawals"),
  }
}

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string }
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/")
  }

  const t = await getTranslations("admin")
  const page = parseInt(searchParams.page || "1")
  const limit = 20

  const where: any = {}

  if (searchParams.status) {
    where.status = searchParams.status
  }

  const [withdrawals, total] = await Promise.all([
    db.withdrawal.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.withdrawal.count({ where }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("withdrawals")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageWithdrawals")}</p>
      </div>

      <WithdrawalsTable
        withdrawals={withdrawals}
        pagination={{
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }}
      />
    </div>
  )
}
