import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ReviewsTable } from "@/components/admin/reviews-table"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("reviews"),
  }
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: { page?: string; rating?: string; search?: string }
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

  if (searchParams.rating) {
    where.rating = parseInt(searchParams.rating)
  }

  if (searchParams.search) {
    where.OR = [
      { comment: { contains: searchParams.search, mode: "insensitive" } },
      {
        user: {
          is: {
            name: { contains: searchParams.search, mode: "insensitive" },
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
    ]
  }

  const [reviews, total, stats] = await Promise.all([
    db.review.findMany({
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
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.review.count({ where }),
    db.review.aggregate({
      _avg: { rating: true },
      _count: true,
    }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("reviews")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageReviews")}</p>
      </div>

      <ReviewsTable
        reviews={reviews}
        stats={{
          averageRating: stats._avg.rating || 0,
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
