"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileText,
  HelpCircle,
  Lock,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Lesson {
  id: string
  titleEn: string
  titleAr?: string
  videoDuration?: number | null
  isFree: boolean
}

interface Chapter {
  id: string
  titleEn: string
  titleAr?: string
  lessons: Lesson[]
}

interface UserProgress {
  lessonId: string
  isCompleted: boolean
}

interface CourseContentProps {
  chapters: Chapter[]
  isEnrolled: boolean
  userProgress: UserProgress[] | null
  courseSlug: string
}

export function CourseContent({
  chapters,
  isEnrolled,
  userProgress,
  courseSlug,
}: CourseContentProps) {
  const t = useTranslations("courses")
  const [expandedChapters, setExpandedChapters] = useState<string[]>([
    chapters[0]?.id || "",
  ])

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId]
    )
  }

  const expandAll = () => {
    setExpandedChapters(chapters.map((c) => c.id))
  }

  const collapseAll = () => {
    setExpandedChapters([])
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return ""
    if (minutes < 60) return `${minutes} ${t("minutes")}`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, "0")}`
  }

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "VIDEO":
        return <PlayCircle className="h-4 w-4" />
      case "ARTICLE":
        return <FileText className="h-4 w-4" />
      case "QUIZ":
        return <HelpCircle className="h-4 w-4" />
      default:
        return <PlayCircle className="h-4 w-4" />
    }
  }

  const isLessonCompleted = (lessonId: string) => {
    return (
      userProgress?.find((p) => p.lessonId === lessonId)?.isCompleted || false
    )
  }

  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0)
  const totalDuration = chapters.reduce(
    (acc, ch) => acc + ch.lessons.reduce((a, l) => a + (l.videoDuration || 0), 0),
    0
  )

  return (
    <div className="bg-background rounded-lg border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">{t("curriculum")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {chapters.length} {t("chapters")} • {totalLessons} {t("lessons")} •{" "}
            {formatDuration(totalDuration)} {t("total")}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={expandAll} className="text-primary hover:underline">
            {t("expandAll")}
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={collapseAll}
            className="text-primary hover:underline"
          >
            {t("collapseAll")}
          </button>
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-2">
        {chapters.map((chapter, chapterIndex) => {
          const isExpanded = expandedChapters.includes(chapter.id)
          const chapterDuration = chapter.lessons.reduce(
            (a, l) => a + (l.videoDuration || 0),
            0
          )
          const completedInChapter = chapter.lessons.filter((l) =>
            isLessonCompleted(l.id)
          ).length

          return (
            <div key={chapter.id} className="border rounded-lg overflow-hidden">
              {/* Chapter Header */}
              <button
                onClick={() => toggleChapter(chapter.id)}
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {chapterIndex + 1}. {chapter.titleAr || chapter.titleEn}
                  </span>
                  {isEnrolled && completedInChapter > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({completedInChapter}/{chapter.lessons.length})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {chapter.lessons.length} {t("lessons")} •{" "}
                    {formatDuration(chapterDuration)}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Lessons */}
              {isExpanded && (
                <div className="divide-y">
                  {chapter.lessons.map((lesson, lessonIndex) => {
                    const isCompleted = isLessonCompleted(lesson.id)
                    const canAccess = isEnrolled || lesson.isFree

                    const LessonContent = (
                      <div
                        className={cn(
                          "flex items-center justify-between p-4 transition-colors",
                          canAccess
                            ? "hover:bg-muted/30 cursor-pointer"
                            : "opacity-70"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isEnrolled && isCompleted ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground">
                              <PlayCircle className="h-4 w-4" />
                            </span>
                          )}
                          <span
                            className={cn(
                              "text-sm",
                              isCompleted && "text-muted-foreground"
                            )}
                          >
                            {lessonIndex + 1}.{" "}
                            {lesson.titleAr || lesson.titleEn}
                          </span>
                          {lesson.isFree && !isEnrolled && (
                            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
                              {t("preview")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {formatDuration(lesson.videoDuration)}
                          </span>
                          {!canAccess && (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    )

                    if (canAccess) {
                      return (
                        <Link
                          key={lesson.id}
                          href={`/courses/${courseSlug}/learn/${lesson.id}`}
                        >
                          {LessonContent}
                        </Link>
                      )
                    }

                    return <div key={lesson.id}>{LessonContent}</div>
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
