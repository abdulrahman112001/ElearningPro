import { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getActiveTeacherSubscription } from "@/lib/access"
import { SubscribeButton } from "@/components/student/subscribe-button"
import { StatusBadge } from "@/components/shared"
import { Check, Crown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Users, BookOpen, Clock, ArrowLeft } from "lucide-react"
import { getInitials, formatPrice, formatDuration } from "@/lib/utils"

interface InstructorPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({
  params,
}: InstructorPageProps): Promise<Metadata> {
  const instructor = await db.user.findUnique({
    where: { id: params.id, role: "INSTRUCTOR" },
    select: { name: true },
  })

  if (!instructor) {
    return { title: "Instructor Not Found" }
  }

  return {
    title: instructor.name || "Instructor",
    description: `Learn from ${instructor.name}`,
  }
}

export default async function InstructorPage({ params }: InstructorPageProps) {
  const t = await getTranslations("instructors")
  const tCourses = await getTranslations("courses")
  const locale = await getLocale()

  const instructor = await db.user.findUnique({
    where: { id: params.id, role: "INSTRUCTOR" },
    include: {
      courses: {
        where: { status: "PUBLISHED" },
        include: {
          category: true,
          chapters: {
            include: {
              lessons: {
                select: { videoDuration: true },
              },
            },
          },
          enrollments: true,
          reviews: {
            select: { rating: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      instructorProfile: true,
    },
  })

  if (!instructor) {
    notFound()
  }

  // Calculate instructor stats
  const totalStudents = instructor.courses.reduce(
    (acc, course) => acc + course.enrollments.length,
    0
  )

  const allReviews = instructor.courses.flatMap((course) => course.reviews)
  const averageRating =
    allReviews.length > 0
      ? allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length
      : 0

  // Monthly subscription offer + the viewer's own status
  const tSub = await getTranslations("subscriptions")
  const session = await auth()
  const offer = instructor.instructorProfile
  const subscriptionEnabled = !!offer?.subscriptionEnabled
  const isSelf = session?.user?.id === instructor.id
  const activeSubscription =
    subscriptionEnabled && session?.user?.id && !isSelf
      ? await getActiveTeacherSubscription(session.user.id, instructor.id)
      : null
  const subscribedUntil = activeSubscription?.endsAt ?? null
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "long",
  })

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/instructors">
            <ArrowLeft className="h-4 w-4 ms-2" />
            {t("title")}
          </Link>
        </Button>

        {/* Instructor Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Avatar */}
              <Avatar className="h-32 w-32 flex-shrink-0">
                <AvatarImage
                  src={instructor.image || ""}
                  alt={instructor.name || ""}
                />
                <AvatarFallback className="text-3xl">
                  {getInitials(instructor.name)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{instructor.name}</h1>

                {instructor.headline && (
                  <p className="text-lg text-muted-foreground mb-4">
                    {instructor.headline}
                  </p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-6 mb-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">
                      ({allReviews.length} {t("reviews")})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{totalStudents}</span>
                    <span className="text-muted-foreground">
                      {t("students")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="font-semibold">
                      {instructor.courses.length}
                    </span>
                    <span className="text-muted-foreground">
                      {t("courses")}
                    </span>
                  </div>
                </div>

                {/* Bio */}
                {instructor.bio && (
                  <div>
                    <h3 className="font-semibold mb-2">{t("bio")}</h3>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {instructor.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly subscription offer */}
        {subscriptionEnabled && offer && (
          <section
            aria-labelledby="teacher-subscription"
            className="relative mb-8 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-soft sm:p-8"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -end-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
            />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
                    <Crown className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 id="teacher-subscription" className="type-h2">
                    {tSub("offerTitle")}
                  </h2>
                  {subscribedUntil && <StatusBadge status="ACTIVE" label={tSub("subscribed")} />}
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {tSub("offerDescription", {
                    name: instructor.name ?? "",
                    count: instructor.courses.length,
                  })}
                </p>
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {(["includeAllCourses", "includeNewCourses", "includeQA", "includeRenew"] as const).map(
                    (key) => (
                      <li key={key} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        <span>{tSub(key, { count: instructor.courses.length })}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border bg-card/80 p-5 text-center shadow-soft backdrop-blur lg:min-w-[17rem]">
                <p className="text-sm text-muted-foreground">{tSub("perMonthLabel")}</p>
                <p className="text-3xl font-bold tabular-nums">
                  {formatPrice(offer.monthlyPrice, "EGP", locale)}
                  {offer.monthlyPrice > 0 && (
                    <span className="ms-1 text-base font-medium text-muted-foreground">
                      / {tSub("month")}
                    </span>
                  )}
                </p>
                {subscribedUntil && (
                  <p className="text-sm font-medium text-success">
                    {tSub("subscribedUntil", { date: dateFmt.format(subscribedUntil) })}
                  </p>
                )}
                {isSelf ? (
                  <p className="text-xs text-muted-foreground">{tSub("ownOffer")}</p>
                ) : (
                  <SubscribeButton
                    alternatives
                    size="lg"
                    className="w-full"
                    instructorId={instructor.id}
                    monthlyPrice={offer.monthlyPrice}
                    subscribed={!!subscribedUntil}
                    label={subscribedUntil ? tSub("renewMonth") : tSub("subscribeNow")}
                  />
                )}
                <p className="text-xs text-muted-foreground">{tSub("securePayment")}</p>
              </div>
            </div>
          </section>
        )}

        {/* Instructor Courses */}
        <div>
          <h2 className="text-2xl font-bold mb-6">
            {t("instructorCourses")} ({instructor.courses.length})
          </h2>

          {instructor.courses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{tCourses("noCourses")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {instructor.courses.map((course) => {
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

                const courseRating =
                  course.reviews.length > 0
                    ? course.reviews.reduce((acc, r) => acc + r.rating, 0) /
                      course.reviews.length
                    : 0

                return (
                  <Card
                    key={course.id}
                    className="overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <Link href={`/courses/${course.slug || course.id}`}>
                      {/* Thumbnail */}
                      <div className="relative aspect-video">
                        {course.thumbnail ? (
                          <Image
                            src={course.thumbnail}
                            alt={course.titleAr || course.titleEn}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <BookOpen className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        {course.price === 0 && (
                          <Badge className="absolute top-2 end-2 bg-green-500">
                            {tCourses("free")}
                          </Badge>
                        )}
                      </div>

                      <CardContent className="p-4">
                        {/* Category */}
                        {course.category && (
                          <Badge variant="secondary" className="mb-2">
                            {course.category.nameAr || course.category.nameEn}
                          </Badge>
                        )}

                        {/* Title */}
                        <h3 className="font-semibold line-clamp-2 mb-2">
                          {course.titleAr || course.titleEn}
                        </h3>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span>{courseRating.toFixed(1)}</span>
                            <span>({course.reviews.length})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{course.enrollments.length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatDuration(totalDuration, locale)}</span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-center justify-between">
                          {course.price === 0 ? (
                            <span className="text-green-600 font-semibold">
                              {tCourses("free")}
                            </span>
                          ) : (
                            <span className="font-bold text-primary">
                              {formatPrice(course.price || 0, "EGP", locale)}
                            </span>
                          )}
                          <Button size="sm" variant="outline">
                            {tCourses("viewDetails")}
                          </Button>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
