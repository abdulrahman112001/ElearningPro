import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, Users, BookOpen, Award } from "lucide-react"
import { getInitials } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("instructors")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function InstructorsPage() {
  const t = await getTranslations("instructors")

  // Get all instructors with their stats
  const instructors = await db.user.findMany({
    where: {
      role: "INSTRUCTOR",
      isBlocked: false,
      courses: {
        some: {
          status: "PUBLISHED",
        },
      },
    },
    include: {
      courses: {
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          titleEn: true,
          titleAr: true,
          averageRating: true,
          totalReviews: true,
          totalStudents: true,
        },
      },
      _count: {
        select: {
          courses: {
            where: { status: "PUBLISHED" },
          },
        },
      },
    },
    orderBy: {
      courses: {
        _count: "desc",
      },
    },
  })

  // Calculate stats for each instructor
  const instructorsWithStats = instructors.map((instructor) => {
    const totalStudents = instructor.courses.reduce(
      (sum, course) => sum + course.totalStudents,
      0
    )
    const totalReviews = instructor.courses.reduce(
      (sum, course) => sum + course.totalReviews,
      0
    )
    const avgRating =
      instructor.courses.length > 0
        ? instructor.courses.reduce(
            (sum, course) => sum + course.averageRating,
            0
          ) / instructor.courses.length
        : 0

    return {
      ...instructor,
      totalStudents,
      totalReviews,
      avgRating,
    }
  })

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        {/* Instructors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {instructorsWithStats.map((instructor) => (
            <Card
              key={instructor.id}
              className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <CardContent className="p-6 text-center">
                {/* Avatar */}
                <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-primary/20">
                  <AvatarImage src={instructor.image || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10">
                    {getInitials(instructor.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name & Headline */}
                <h3 className="font-bold text-lg mb-1">{instructor.name}</h3>
                {instructor.headline && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {instructor.headline}
                  </p>
                )}

                {/* Rating */}
                <div className="flex items-center justify-center gap-1 mb-4">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold">
                    {instructor.avgRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({instructor.totalReviews} {t("reviews")})
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 py-4 border-y mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-primary mb-1">
                      <Users className="h-4 w-4" />
                      <span className="font-bold">
                        {instructor.totalStudents.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("students")}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-primary mb-1">
                      <BookOpen className="h-4 w-4" />
                      <span className="font-bold">
                        {instructor._count.courses}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("courses")}
                    </p>
                  </div>
                </div>

                {/* View Profile Button */}
                <Button asChild className="w-full">
                  <Link href={`/instructors/${instructor.id}`}>
                    {t("viewProfile")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {instructorsWithStats.length === 0 && (
          <div className="text-center py-16">
            <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("noInstructors")}</h3>
            <p className="text-muted-foreground">
              {t("noInstructorsDescription")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
