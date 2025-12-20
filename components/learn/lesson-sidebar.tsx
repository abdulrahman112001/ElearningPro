"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ChevronDown,
  ChevronUp,
  PlayCircle,
  CheckCircle,
  Lock,
  Clock,
  FileText,
  Video,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Lesson {
  id: string
  title: string
  titleAr?: string
  duration?: number
  isFree?: boolean
  type?: string
}

interface Chapter {
  id: string
  title: string
  titleAr?: string
  lessons: Lesson[]
}

interface Course {
  id: string
  slug: string
  chapters: Chapter[]
}

interface Progress {
  id: string
  isCompleted: boolean
  watchedSeconds: number
}

interface LessonSidebarProps {
  course: Course
  currentLessonId: string
  progressMap: Map<string, Progress>
}

export function LessonSidebar({
  course,
  currentLessonId,
  progressMap,
}: LessonSidebarProps) {
  const t = useTranslations("learn")
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    // Find which chapter contains the current lesson
    const currentChapter = course.chapters.find((ch) =>
      ch.lessons.some((l) => l.id === currentLessonId)
    )
    return new Set(currentChapter ? [currentChapter.id] : [])
  })

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
      }
      return next
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return ""
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const getChapterProgress = (chapter: Chapter) => {
    const completedCount = chapter.lessons.filter(
      (lesson) => progressMap.get(lesson.id)?.isCompleted
    ).length
    return {
      completed: completedCount,
      total: chapter.lessons.length,
      percentage:
        chapter.lessons.length > 0
          ? Math.round((completedCount / chapter.lessons.length) * 100)
          : 0,
    }
  }

  return (
    <div className="w-80 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b font-semibold">{t("courseContent")}</div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {course.chapters.map((chapter, chapterIndex) => {
            const isExpanded = expandedChapters.has(chapter.id)
            const progress = getChapterProgress(chapter)

            return (
              <div key={chapter.id} className="mb-2">
                {/* Chapter Header */}
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-right"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                      {chapterIndex + 1}
                    </div>
                    <div className="flex-1 text-right">
                      <h3 className="font-medium text-sm line-clamp-1">
                        {chapter.titleAr || chapter.titleEn}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {progress.completed} / {progress.total}{" "}
                        {t("lessonsCompleted")}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* Chapter Progress Bar */}
                {!isExpanded && (
                  <div className="mx-3 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                )}

                {/* Lessons */}
                {isExpanded && (
                  <div className="mt-1 mr-4 space-y-1">
                    {chapter.lessons.map((lesson, lessonIndex) => {
                      const lessonProgress = progressMap.get(lesson.id)
                      const isCurrent = lesson.id === currentLessonId
                      const isCompleted = lessonProgress?.isCompleted

                      return (
                        <Link
                          key={lesson.id}
                          href={`/courses/${course.slug}/learn/${lesson.id}`}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg text-sm transition-colors",
                            isCurrent
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {/* Status Icon */}
                          <div className="flex-shrink-0">
                            {isCompleted ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : isCurrent ? (
                              <PlayCircle className="h-4 w-4 text-primary fill-primary/20" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                            )}
                          </div>

                          {/* Lesson Info */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "line-clamp-1",
                                isCurrent && "font-medium"
                              )}
                            >
                              {lessonIndex + 1}.{" "}
                              {lesson.titleAr || lesson.titleEn}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {lesson.type === "VIDEO" ? (
                                <Video className="h-3 w-3" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              {lesson.videoDuration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(lesson.videoDuration)}
                                </span>
                              )}
                              {lesson.isFree && (
                                <span className="text-green-500">
                                  {t("free")}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
