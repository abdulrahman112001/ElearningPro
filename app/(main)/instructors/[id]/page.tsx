import { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
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

                {instructor.instructorProfile?.headline && (
                  <p className="text-lg text-muted-foreground mb-4">
                    {instructor.instructorProfile.headline}
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
                {instructor.instructorProfile?.bio && (
                  <div>
                    <h3 className="font-semibold mb-2">{t("bio")}</h3>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {instructor.instructorProfile.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
                        {course.isFree && (
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
                            <span>{formatDuration(totalDuration)}</span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-center justify-between">
                          {course.isFree ? (
                            <span className="text-green-600 font-semibold">
                              {tCourses("free")}
                            </span>
                          ) : (
                            <span className="font-bold text-primary">
                              {formatPrice(course.price || 0)}
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
