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
import { Star, Users, BookOpen, Clock, ArrowRight, GraduationCap, Award } from "lucide-react"
import { getInitials, formatPrice, formatDuration } from "@/lib/utils"

interface InstructorPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: InstructorPageProps): Promise<Metadata> {
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
        {/* Instructor Header Card */}
        <Card className="mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent h-32" />
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col md:flex-row gap-6 items-start -mt-16">
              {/* Avatar */}
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl flex-shrink-0">
                <AvatarImage src={instructor.image || ""} alt={instructor.name || ""} />
                <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                  {getInitials(instructor.name)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 mt-8 md:mt-4">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{instructor.name}</h1>
                  <Badge variant="secondary" className="gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {t("title")}
                  </Badge>
                </div>
                
                {instructor.instructorProfile?.headline && (
                  <p className="text-lg text-muted-foreground mb-4">
                    {instructor.instructorProfile.headline}
                  </p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 rounded-full">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">{averageRating.toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">
                      ({allReviews.length} {t("reviews")})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{totalStudents}</span>
                    <span className="text-muted-foreground text-sm">{t("students")}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-full">
                    <BookOpen className="h-5 w-5 text-green-600" />
                    <span className="font-semibold">{instructor.courses.length}</span>
                    <span className="text-muted-foreground text-sm">{t("courses")}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio Section */}
        {instructor.instructorProfile?.bio && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                {t("aboutInstructor")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {instructor.instructorProfile.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Instructor Courses */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              {t("instructorCourses")} 
              <Badge variant="secondary">{instructor.courses.length}</Badge>
            </h2>
          </div>

          {instructor.courses.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{tCourses("noCourses")}</h3>
                <p className="text-muted-foreground">
                  {tCourses("noCoursesDescription")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {instructor.courses.map((course) => {
                const totalDuration = course.chapters.reduce(
                  (acc, ch) =>
                    acc +
                    ch.lessons.reduce(
                      (lessonAcc, lesson) => lessonAcc + (lesson.videoDuration || 0),
                      0
                    ),
                  0
                )

                const courseRating =
                  course.reviews.length > 0
                    ? course.reviews.reduce((acc, r) => acc + r.rating, 0) /
                      course.reviews.length
                    : 0

                const totalLessons = course.chapters.reduce(
                  (acc, ch) => acc + ch.lessons.length,
                  0
                )

                return (
                  <Link key={course.id} href={`/courses/${course.slug || course.id}`}>
                    <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                      {/* Thumbnail */}
                      <div className="relative aspect-video overflow-hidden">
                        {course.thumbnail ? (
                          <Image
                            src={course.thumbnail}
                            alt={course.titleAr || course.titleEn}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <BookOpen className="h-16 w-16 text-primary/30" />
                          </div>
                        )}
                        {course.isFree && (
                          <Badge className="absolute top-3 end-3 bg-green-500 shadow-lg">
                            {tCourses("free")}
                          </Badge>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <CardContent className="p-5">
                        {/* Category */}
                        {course.category && (
                          <Badge variant="outline" className="mb-3">
                            {course.category.nameAr || course.category.nameEn}
                          </Badge>
                        )}

                        {/* Title */}
                        <h3 className="font-bold text-lg line-clamp-2 mb-3 group-hover:text-primary transition-colors">
                          {course.titleAr || course.titleEn}
                        </h3>

                        {/* Stats Row */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-medium">{courseRating.toFixed(1)}</span>
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

                        {/* Lessons count */}
                        <div className="text-sm text-muted-foreground mb-4">
                          {totalLessons} {tCourses("lessons")} • {course.chapters.length} {tCourses("chapters")}
                        </div>

                        {/* Price & CTA */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          {course.isFree ? (
                            <span className="text-green-600 font-bold text-lg">
                              {tCourses("free")}
                            </span>
                          ) : (
                            <div>
                              <span className="font-bold text-xl text-primary">
                                {formatPrice(course.discountPrice || course.price || 0)}
                              </span>
                              {course.discountPrice && course.price && (
                                <span className="text-sm text-muted-foreground line-through me-2">
                                  {formatPrice(course.price)}
                                </span>
                              )}
                            </div>
                          )}
                          <Button size="sm" className="group/btn">
                            {tCourses("viewDetails")}
                            <ArrowRight className="h-4 w-4 me-1 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
