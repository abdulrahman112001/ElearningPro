import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { CouponsTable } from "@/components/admin/coupons-table"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("coupons"),
  }
}

export default async function AdminCouponsPage({
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

  if (searchParams.status === "active") {
    where.isActive = true
    where.OR = [{ expiryDate: null }, { expiryDate: { gte: new Date() } }]
  } else if (searchParams.status === "expired") {
    where.OR = [{ isActive: false }, { expiryDate: { lt: new Date() } }]
  }

  if (searchParams.search) {
    where.code = { contains: searchParams.search, mode: "insensitive" }
  }

  const [coupons, total] = await Promise.all([
    db.coupon.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            purchases: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.coupon.count({ where }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("coupons")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageCoupons")}</p>
      </div>

      <CouponsTable
        coupons={coupons as any}
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
