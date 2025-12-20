"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  PlayCircle,
  CheckCircle,
  Lock,
  FileText,
  X,
  Menu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface Chapter {
  id: string
  titleEn: string
  titleAr?: string
  position: number
  lessons: Lesson[]
}

interface Lesson {
  id: string
  titleEn: string
  titleAr?: string
  type: string
  videoDuration?: number
  isFree: boolean
}

interface CourseSidebarProps {
  course: {
    id: string
    slug: string
    titleEn: string
    titleAr?: string
  }
  chapters: Chapter[]
  currentLessonId: string
  userId: string
}

export function CourseSidebar({
  course,
  chapters,
  currentLessonId,
  userId,
}: CourseSidebarProps) {
  const pathname = usePathname()
  const [expandedChapters, setExpandedChapters] = useState<string[]>([])
  const [progressData, setProgressData] = useState<Record<string, boolean>>({})
  const [courseProgress, setCourseProgress] = useState(0)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    // Expand chapter containing current lesson
    const currentChapter = chapters.find((ch) =>
      ch.lessons.some((l) => l.id === currentLessonId)
    )
    if (currentChapter && !expandedChapters.includes(currentChapter.id)) {
      setExpandedChapters([...expandedChapters, currentChapter.id])
    }

    // Fetch progress
    fetchProgress()
  }, [currentLessonId])

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/progress/course/${course.id}`)
      if (response.ok) {
        const data = await response.json()
        setProgressData(data.lessonProgress || {})
        setCourseProgress(data.courseProgress || 0)
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error)
    }
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId]
    )
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return ""
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getLessonIcon = (lesson: Lesson, isCompleted: boolean) => {
    if (isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }

    switch (lesson.type) {
      case "VIDEO":
        return <PlayCircle className="h-4 w-4" />
      case "ARTICLE":
        return <FileText className="h-4 w-4" />
      default:
        return <PlayCircle className="h-4 w-4" />
    }
  }

  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0)
  const completedLessons = Object.values(progressData).filter(Boolean).length

  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-semibold text-sm line-clamp-2">
            {course.titleAr || course.titleEn}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-2">
          <Progress value={courseProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {completedLessons} of {totalLessons} lessons completed
          </p>
        </div>
      </div>

      {/* Chapters & Lessons */}
      <div className="flex-1 overflow-y-auto">
        {chapters.map((chapter) => {
          const isExpanded = expandedChapters.includes(chapter.id)
          const chapterCompleted = chapter.lessons.every(
            (l) => progressData[l.id]
          )

          return (
            <div key={chapter.id} className="border-b">
              {/* Chapter Header */}
              <button
                onClick={() => toggleChapter(chapter.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 text-left">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="font-medium text-sm">
                    {chapter.titleAr || chapter.titleEn}
                  </span>
                </div>
                {chapterCompleted && (
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                )}
              </button>

              {/* Lessons */}
              {isExpanded && (
                <div className="bg-muted/30">
                  {chapter.lessons.map((lesson) => {
                    const isCompleted = progressData[lesson.id]
                    const isCurrent = lesson.id === currentLessonId

                    return (
                      <Link
                        key={lesson.id}
                        href={`/courses/${course.slug}/learn/${lesson.id}`}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 p-3 pl-10 hover:bg-muted transition-colors border-l-2",
                          isCurrent
                            ? "border-primary bg-primary/5"
                            : "border-transparent"
                        )}
                      >
                        <div className="flex-shrink-0">
                          {getLessonIcon(lesson, isCompleted)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm line-clamp-2",
                              isCurrent && "font-medium text-primary"
                            )}
                          >
                            {lesson.titleAr || lesson.titleEn}
                          </p>
                          {lesson.videoDuration && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDuration(lesson.videoDuration)}
                            </p>
                          )}
                        </div>

                        {!lesson.isFree && !isCompleted && (
                          <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-opacity duration-300",
          isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setIsMobileOpen(false)}
        />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-80 bg-background shadow-xl transition-transform duration-300",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-80 border-r bg-background">
        {sidebarContent}
      </div>
    </>
  )
}
