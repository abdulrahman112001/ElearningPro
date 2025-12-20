"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Download,
  FileText,
  Video,
  Link as LinkIcon,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Resource {
  id: string
  name: string
  type: string
  url: string
  size?: number
}

interface Lesson {
  id: string
  title: string
  titleAr?: string
  description?: string
  descriptionAr?: string
  type?: string
  resources?: Resource[]
}

interface PreviousLesson {
  id: string
  title: string
  titleAr?: string
}

interface NextLesson {
  id: string
  title: string
  titleAr?: string
}

interface LessonContentProps {
  lesson: Lesson
  previousLesson: PreviousLesson | null
  nextLesson: NextLesson | null
  courseSlug: string
  isCompleted: boolean
  enrollmentId?: string
}

export function LessonContent({
  lesson,
  previousLesson,
  nextLesson,
  courseSlug,
  isCompleted,
  enrollmentId,
}: LessonContentProps) {
  const t = useTranslations("learn")
  const [isMarking, setIsMarking] = useState(false)
  const [completed, setCompleted] = useState(isCompleted)

  const handleMarkComplete = async () => {
    if (!enrollmentId) return

    setIsMarking(true)
    try {
      const response = await fetch(`/api/progress/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          isCompleted: !completed,
        }),
      })

      if (!response.ok) throw new Error("Failed to update progress")

      setCompleted(!completed)
      toast.success(completed ? t("markedIncomplete") : t("markedComplete"))
    } catch (error) {
      toast.error(t("error"))
    } finally {
      setIsMarking(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ""
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    const kb = bytes / 1024
    return `${kb.toFixed(1)} KB`
  }

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "video":
        return <Video className="h-4 w-4" />
      case "link":
        return <LinkIcon className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          {lesson.resources && lesson.resources.length > 0 && (
            <TabsTrigger value="resources">{t("resources")}</TabsTrigger>
          )}
          <TabsTrigger value="notes">{t("notes")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                {lesson.titleAr || lesson.titleEn}
              </h1>
              {lesson.descriptionEn && (
                <p className="mt-2 text-muted-foreground">
                  {lesson.descriptionAr || lesson.descriptionEn}
                </p>
              )}
            </div>

            <Button
              onClick={handleMarkComplete}
              disabled={isMarking}
              variant={completed ? "default" : "outline"}
              className="flex-shrink-0"
            >
              {isMarking ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <CheckCircle
                  className={`h-4 w-4 ml-2 ${completed ? "fill-current" : ""}`}
                />
              )}
              {completed ? t("completed") : t("markComplete")}
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t">
            {previousLesson ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/courses/${courseSlug}/learn/${previousLesson.id}`}
                >
                  <ArrowRight className="h-4 w-4 ml-2" />
                  <span className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">
                      {t("previous")}
                    </span>
                    <span className="text-sm line-clamp-1">
                      {previousLesson.titleAr || previousLesson.titleEn}
                    </span>
                  </span>
                </Link>
              </Button>
            ) : (
              <div />
            )}

            {nextLesson ? (
              <Button asChild>
                <Link href={`/courses/${courseSlug}/learn/${nextLesson.id}`}>
                  <span className="flex flex-col items-end">
                    <span className="text-xs opacity-80">{t("next")}</span>
                    <span className="text-sm line-clamp-1">
                      {nextLesson.titleAr || nextLesson.titleEn}
                    </span>
                  </span>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/courses/${courseSlug}`}>{t("finishCourse")}</Link>
              </Button>
            )}
          </div>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>{t("downloadableResources")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lesson.resources?.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                  >
                    {getResourceIcon(resource.type)}
                    <div className="flex-1">
                      <p className="font-medium">{resource.name}</p>
                      {resource.size && (
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(resource.size)}
                        </p>
                      )}
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>{t("yourNotes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full h-64 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                placeholder={t("writeNotesHere")}
              />
              <Button className="mt-2">{t("saveNotes")}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
