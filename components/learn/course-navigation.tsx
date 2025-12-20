"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CourseNavigationProps {
  courseSlug: string
  previousLesson?: {
    id: string
    titleEn: string
    titleAr?: string
  } | null
  nextLesson?: {
    id: string
    titleEn: string
    titleAr?: string
  } | null
}

export function CourseNavigation({
  courseSlug,
  previousLesson,
  nextLesson,
}: CourseNavigationProps) {
  return (
    <div className="flex items-center justify-between gap-4 pt-6 border-t">
      {/* Previous Lesson */}
      {previousLesson ? (
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/courses/${courseSlug}/learn/${previousLesson.id}`}>
            <ArrowLeft className="ml-2 h-4 w-4" />
            <div className="text-left flex-1">
              <p className="text-xs text-muted-foreground">Previous</p>
              <p className="font-medium line-clamp-1">
                {previousLesson.titleAr || previousLesson.titleEn}
              </p>
            </div>
          </Link>
        </Button>
      ) : (
        <div className="flex-1" />
      )}

      {/* Next Lesson */}
      {nextLesson ? (
        <Button asChild className="flex-1">
          <Link href={`/courses/${courseSlug}/learn/${nextLesson.id}`}>
            <div className="text-right flex-1">
              <p className="text-xs opacity-90">Next</p>
              <p className="font-medium line-clamp-1">
                {nextLesson.titleAr || nextLesson.titleEn}
              </p>
            </div>
            <ArrowRight className="mr-2 h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  )
}
