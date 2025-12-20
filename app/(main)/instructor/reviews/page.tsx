import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Star, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("reviews"),
  }
}

export default async function InstructorReviewsPage() {
  const session = await auth()
  const t = await getTranslations("instructor")

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  // Get all reviews for instructor's courses
  const reviews = await db.review.findMany({
    where: {
      course: {
        instructorId: session.user.id,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      course: {
        select: {
          id: true,
          titleEn: true,
          titleAr: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Calculate stats
  const totalReviews = reviews.length
  const averageRating =
    totalReviews > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews
      : 0
  const ratingCounts = [5, 4, 3, 2, 1].map(
    (rating) => reviews.filter((r) => r.rating === rating).length
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("reviews")}</h1>
        <p className="text-muted-foreground">
          {t("reviewsDescription") || "تقييمات الطلاب على كورساتك"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalReviews") || "إجمالي التقييمات"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReviews}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("averageRating")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {averageRating.toFixed(1)}
              </span>
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("ratingDistribution") || "توزيع التقييمات"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((rating, index) => (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <span className="w-3">{rating}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400"
                      style={{
                        width: `${
                          totalReviews > 0
                            ? (ratingCounts[index] / totalReviews) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-muted-foreground">
                    {ratingCounts[index]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("allReviews") || "جميع التقييمات"}</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t("noReviews") || "لا توجد تقييمات"}
              </h3>
              <p className="text-muted-foreground">
                {t("noReviewsDescription") ||
                  "لم يقم أي طالب بتقييم كورساتك بعد"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={review.user.image || undefined} />
                        <AvatarFallback>
                          {review.user.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{review.user.name}</p>
                        <Link
                          href={`/courses/${review.course.slug}`}
                          className="text-sm text-muted-foreground hover:text-primary"
                        >
                          {review.course.titleAr || review.course.titleEn}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-muted-foreground">{review.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
