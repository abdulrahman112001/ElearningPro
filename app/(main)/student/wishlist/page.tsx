import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Star, Users, Clock, BookOpen, Trash2 } from "lucide-react"
import { formatPrice, formatDuration } from "@/lib/utils"
import { RemoveFromWishlistButton } from "@/components/student/remove-from-wishlist-button"

export async function generateMetadata() {
  const t = await getTranslations("student")
  return {
    title: t("wishlist"),
  }
}

export default async function StudentWishlistPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const t = await getTranslations("student")
  const tCourses = await getTranslations("courses")

  // Get user's wishlist
  const wishlist = await db.wishlist.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          instructor: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          category: true,
          chapters: {
            include: {
              lessons: {
                select: { videoDuration: true },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
              reviews: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Heart className="h-8 w-8 text-red-500" />
            {t("wishlist")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("wishlistDescription")}
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {wishlist.length} {tCourses("courses")}
        </Badge>
      </div>

      {wishlist.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("emptyWishlist")}</h3>
            <p className="text-muted-foreground mb-6">
              {t("emptyWishlistDescription")}
            </p>
            <Button asChild>
              <Link href="/courses">{tCourses("browseCourses")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlist.map((item) => {
            const course = item.course
            const totalDuration = course.chapters.reduce(
              (acc, ch) =>
                acc +
                ch.lessons.reduce(
                  (lessonAcc, lesson) =>
                    lessonAcc + (lesson.videoDuration || 0),
                  0
                ),
              0
            )

            return (
              <Card
                key={item.id}
                className="overflow-hidden group hover:shadow-lg transition-all"
              >
                <Link href={`/courses/${course.slug}`}>
                  <div className="relative aspect-video">
                    {course.thumbnail ? (
                      <Image
                        src={course.thumbnail}
                        alt={course.titleAr || course.titleEn}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-primary/30" />
                      </div>
                    )}
                    {course.price === 0 && (
                      <Badge className="absolute top-2 end-2 bg-green-500">
                        {tCourses("free")}
                      </Badge>
                    )}
                  </div>
                </Link>

                <CardContent className="p-4">
                  {course.category && (
                    <Badge variant="outline" className="mb-2">
                      {course.category.nameAr || course.category.nameEn}
                    </Badge>
                  )}

                  <Link href={`/courses/${course.slug}`}>
                    <h3 className="font-semibold line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {course.titleAr || course.titleEn}
                    </h3>
                  </Link>

                  <p className="text-sm text-muted-foreground mb-3">
                    {course.instructor.name}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span>{course.averageRating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{course._count.enrollments}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(totalDuration)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      {course.price === 0 ? (
                        <span className="text-green-600 font-bold">
                          {tCourses("free")}
                        </span>
                      ) : (
                        <span className="font-bold text-primary">
                          {formatPrice(course.discountPrice || course.price)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <RemoveFromWishlistButton wishlistId={item.id} />
                      <Button size="sm" asChild>
                        <Link href={`/courses/${course.slug}`}>
                          {tCourses("viewDetails")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
