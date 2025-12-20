"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRight, ArrowLeft, X, Menu, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface Course {
  id: string
  titleEn: string
  titleAr?: string
  slug: string
}

interface Lesson {
  id: string
  titleEn: string
  titleAr?: string
  chapter: {
    titleEn: string
    titleAr?: string
  }
}

interface LessonNavigationProps {
  course: Course
  currentLesson: Lesson
  overallProgress: number
}

export function LessonNavigation({
  course,
  currentLesson,
  overallProgress,
}: LessonNavigationProps) {
  const t = useTranslations("learn")
  const router = useRouter()

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Back to Course */}
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/courses/${course.slug}`}>
            <X className="h-4 w-4 ml-2" />
            {t("exitCourse")}
          </Link>
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Course Title */}
        <div className="hidden md:block">
          <h2 className="font-medium text-sm truncate max-w-[200px] lg:max-w-[300px]">
            {course.titleAr || course.titleEn}
          </h2>
        </div>
      </div>

      {/* Center Section - Progress */}
      <div className="flex items-center gap-4 flex-1 max-w-md mx-4">
        <Progress value={overallProgress} className="h-2" />
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {overallProgress}%
        </span>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Dashboard Link */}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/student">
            <LayoutDashboard className="h-4 w-4 ml-2" />
            <span className="hidden sm:inline">{t("dashboard")}</span>
          </Link>
        </Button>
      </div>
    </header>
  )
}
