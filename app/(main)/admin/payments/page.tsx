import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PaymentsTable } from "@/components/admin/payments-table"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("payments"),
  }
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; search?: string }
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

  if (searchParams.search) {
    where.OR = [
      {
        user: {
          is: {
            name: { contains: searchParams.search, mode: "insensitive" },
          },
        },
      },
      {
        user: {
          is: {
            email: { contains: searchParams.search, mode: "insensitive" },
          },
        },
      },
      {
        course: {
          is: {
            titleEn: { contains: searchParams.search, mode: "insensitive" },
          },
        },
      },
      {
        providerId: {
          contains: searchParams.search,
          mode: "insensitive",
        },
      },
    ]
  }

  const [payments, total, stats] = await Promise.all([
    db.purchase.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        course: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            instructor: {
              select: {
                name: true,
              },
            },
          },
        },
        coupon: {
          select: {
            code: true,
            discountValue: true,
            discountType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.purchase.count({ where }),
    db.purchase.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("payments")}</h1>
        <p className="text-muted-foreground mt-1">{t("managePayments")}</p>
      </div>

      <PaymentsTable
        payments={payments}
        stats={{
          totalAmount: stats._sum.amount || 0,
          totalCount: stats._count || 0,
        }}
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
