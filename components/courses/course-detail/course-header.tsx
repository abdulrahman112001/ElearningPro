"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import {
  Clock,
  Users,
  Star,
  PlayCircle,
  BookOpen,
  Globe,
  Award,
  BarChart3,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface CourseHeaderProps {
  course: {
    id: string
    titleEn: string
    titleAr?: string
    descriptionEn?: string
    descriptionAr?: string
    thumbnail?: string | null
    price: number
    level: string
    language: string
    averageRating: number
    instructor: {
      id: string
      name: string | null
      image?: string | null
    }
    category: {
      id: string
      nameEn: string
      nameAr?: string
    } | null
    _count: {
      enrollments: number
      reviews: number
    }
  }
  totalLessons: number
  totalDuration: number
}

export function CourseHeader({
  course,
  totalLessons,
  totalDuration,
}: CourseHeaderProps) {
  const t = useTranslations("courses")

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours} ${t("hours")} ${
        mins > 0 ? `${mins} ${t("minutes")}` : ""
      }`
    }
    return `${mins} ${t("minutes")}`
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

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Course Info */}
          <motion.div
            className="flex-1 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Link
                href="/courses"
                className="hover:text-white transition-colors"
              >
                {t("browseCourses")}
              </Link>
              <span>/</span>
              {course.category && (
                <Link
                  href={`/courses?category=${course.category.id}`}
                  className="hover:text-white transition-colors"
                >
                  {course.category.nameAr || course.category.nameEn}
                </Link>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold">
              {course.titleAr || course.titleEn}
            </h1>

            {/* Description */}
            {(course.descriptionEn || course.descriptionAr) && (
              <p className="text-lg text-gray-300 max-w-3xl line-clamp-3">
                {(course.descriptionAr || course.descriptionEn || "")
                  .replace(/<[^>]*>/g, "")
                  .slice(0, 200)}
                ...
              </p>
            )}

            {/* Rating & Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-yellow-400 font-bold">
                  {course.averageRating.toFixed(1)}
                </span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(course.averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-500"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-gray-400">
                  ({course._count.reviews.toLocaleString()} {t("reviews")})
                </span>
              </div>
              <div className="flex items-center gap-1 text-gray-300">
                <Users className="h-4 w-4" />
                <span>
                  {course._count.enrollments.toLocaleString()} {t("students")}
                </span>
              </div>
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{t("createdBy")}</span>
              <Link
                href={`/instructors/${course.instructor.id}`}
                className="text-primary-foreground hover:underline font-medium"
              >
                {course.instructor.name}
              </Link>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>
                  {course.language === "AR"
                    ? "العربية"
                    : course.language === "EN"
                    ? "English"
                    : "العربية والإنجليزية"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>{getLevelText(course.level)}</span>
              </div>
              <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                <span>
                  {totalLessons} {t("lessons")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(totalDuration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                <span>{t("certificate")}</span>
              </div>
            </div>
          </motion.div>

          {/* Thumbnail - Hidden on mobile, shown in sidebar */}
          <motion.div
            className="hidden lg:block w-96 aspect-video rounded-lg overflow-hidden shadow-2xl"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {course.thumbnail ? (
              <Image
                src={course.thumbnail}
                alt={course.titleAr || course.titleEn}
                width={400}
                height={225}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/50 to-primary/20 flex items-center justify-center">
                <PlayCircle className="h-16 w-16 text-white/50" />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
