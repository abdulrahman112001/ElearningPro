"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import {
  Clock,
  Users,
  Star,
  BookOpen,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

interface Course {
  id: string
  title: string
  titleAr?: string
  slug: string
  description?: string
  thumbnail?: string
  price: number
  discountPrice?: number
  level: string
  language: string
  duration?: number
  averageRating: number
  instructor: {
    id: string
    name: string
    image?: string
  }
  category: {
    id: string
    name: string
    nameAr?: string
  }
  chapters: {
    lessons: { id: string }[]
  }[]
  _count: {
    enrollments: number
    reviews: number
  }
}

interface CoursesGridProps {
  courses: Course[]
  totalPages: number
  currentPage: number
}

export function CoursesGrid({
  courses,
  totalPages,
  currentPage,
}: CoursesGridProps) {
  const t = useTranslations("courses")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const getLevelBadge = (level: string) => {
    const levelColors: Record<string, string> = {
      BEGINNER:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      INTERMEDIATE:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      ADVANCED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      ALL_LEVELS:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    }
    return levelColors[level] || levelColors.BEGINNER
  }

  const getLevelText = (level: string) => {
    const levels: Record<string, string> = {
      BEGINNER: t("beginner"),
      INTERMEDIATE: t("intermediate"),
      ADVANCED: t("advanced"),
      ALL_LEVELS: t("allLevels"),
    }
    return levels[level] || levels.BEGINNER
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return ""
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours} ${t("hours")} ${
        mins > 0 ? `${mins} ${t("minutes")}` : ""
      }`
    }
    return `${mins} ${t("minutes")}`
  }

  const getTotalLessons = (chapters: { lessons: { id: string }[] }[]) => {
    return chapters.reduce(
      (total, chapter) => total + chapter.lessons.length,
      0
    )
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">{t("noCourses")}</h3>
        <p className="text-muted-foreground mb-4">
          {t("noCoursesDescription")}
        </p>
        <Button onClick={() => router.push("/courses")}>
          {t("clearFilters")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link href={`/courses/${course.slug}`}>
              <Card className="h-full overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={course.titleEn}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <PlayCircle className="h-12 w-12 text-primary/50" />
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between">
                    <Badge className={getLevelBadge(course.level)}>
                      {getLevelText(course.level)}
                    </Badge>
                    {course.discountPrice &&
                      course.discountPrice < course.price && (
                        <Badge variant="destructive">
                          -
                          {Math.round(
                            (1 - course.discountPrice / course.price) * 100
                          )}
                          %
                        </Badge>
                      )}
                  </div>
                </div>

                <CardContent className="p-4">
                  {/* Category */}
                  <p className="text-xs text-primary font-medium mb-2">
                    {course.category.nameAr || course.category.nameEn}
                  </p>

                  {/* Title */}
                  <h3 className="font-semibold line-clamp-2 mb-3 group-hover:text-primary transition-colors">
                    {course.titleAr || course.titleEn}
                  </h3>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <PlayCircle className="h-4 w-4" />
                      <span>
                        {getTotalLessons(course.chapters)} {t("lessons")}
                      </span>
                    </div>
                    {course.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(course.duration)}</span>
                      </div>
                    )}
                  </div>

                  {/* Rating & Enrollments */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">
                        {course.averageRating.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        ({course._count.reviews})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Users className="h-4 w-4" />
                      <span>{course._count.enrollments.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0 flex items-center justify-between">
                  {/* Instructor */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={course.instructor.image || ""} />
                      <AvatarFallback className="text-xs">
                        {course.instructor.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                      {course.instructor.name}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="text-left">
                    {course.price === 0 ? (
                      <span className="text-lg font-bold text-green-600">
                        {t("free")}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {course.discountPrice &&
                        course.discountPrice < course.price ? (
                          <>
                            <span className="text-lg font-bold">
                              {course.discountPrice.toFixed(0)} ج.م
                            </span>
                            <span className="text-sm text-muted-foreground line-through">
                              {course.price.toFixed(0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold">
                            {course.price.toFixed(0)} ج.م
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              // Show first, last, and pages around current
              return (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              )
            })
            .map((page, index, array) => {
              // Add ellipsis
              const showEllipsisBefore =
                index > 0 && page - array[index - 1] > 1

              return (
                <div key={page} className="flex items-center gap-2">
                  {showEllipsisBefore && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <Button
                    variant={page === currentPage ? "default" : "outline"}
                    size="icon"
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </Button>
                </div>
              )
            })}

          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
