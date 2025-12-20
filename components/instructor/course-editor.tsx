"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  Layers,
  FileText,
  Upload,
  Loader2,
  MoreVertical,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  Video,
  FileQuestion,
  Edit,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ChapterEditor } from "./chapter-editor"
import { LessonEditor } from "./lesson-editor"
import { QuizEditor } from "./quiz-editor"
const courseSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  titleAr: z.string().optional(),
  description: z.string().min(50, "Description must be at least 50 characters"),
  descriptionAr: z.string().optional(),
  shortDescription: z.string().max(200).optional(),
  shortDescriptionAr: z.string().max(200).optional(),
  price: z.number().min(0),
  discountPrice: z.number().min(0).optional(),
  categoryId: z.string().min(1, "Please select a category"),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"]),
  language: z.string().min(1),
  requirements: z.string().optional(),
  objectives: z.string().optional(),
  targetAudience: z.string().optional(),
})

type CourseFormData = z.infer<typeof courseSchema>

interface Chapter {
  id: string
  titleEn: string
  titleAr?: string
  position: number
  isPublished: boolean
  lessons: Lesson[]
}

interface Lesson {
  id: string
  titleEn: string
  titleAr?: string
  descriptionEn?: string
  descriptionAr?: string
  type: string
  videoUrl?: string
  videoProvider?: string
  position: number
  videoDuration?: number
  isPublished: boolean
  isFree: boolean
  isPreview?: boolean
}

interface CourseEditorProps {
  course: {
    id: string
    titleEn: string
    titleAr?: string
    slug: string
    descriptionEn?: string
    descriptionAr?: string
    shortDescEn?: string
    shortDescAr?: string
    price: number
    discountPrice?: number
    thumbnail?: string
    previewVideo?: string
    categoryId?: string
    level: string
    language: string
    requirements?: string[]
    whatYouLearn?: string[]
    targetAudience?: string
    status: string
    chapters: Chapter[]
  }
  categories: Array<{
    id: string
    name: string
    nameAr?: string
  }>
}

export function CourseEditor({ course, categories }: CourseEditorProps) {
  const t = useTranslations("instructor")
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [chapters, setChapters] = useState<Chapter[]>(course.chapters)
  const [expandedChapters, setExpandedChapters] = useState<string[]>([])
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [editingLesson, setEditingLesson] = useState<{
    lesson: Lesson
    chapterId: string
  } | null>(null)
  const [isAddingChapter, setIsAddingChapter] = useState(false)
  const [isAddingLesson, setIsAddingLesson] = useState<string | null>(null)
  const [thumbnail, setThumbnail] = useState<string | null>(
    course.thumbnail || null
  )
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [previewVideo, setPreviewVideo] = useState<string>(
    course.previewVideo || ""
  )
  const [editingQuiz, setEditingQuiz] = useState<{
    lessonId: string
    chapterId: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: course.titleEn || "",
      titleAr: course.titleAr || "",
      description: course.descriptionEn || "",
      descriptionAr: course.descriptionAr || "",
      shortDescription: course.shortDescEn || "",
      shortDescriptionAr: course.shortDescAr || "",
      price: course.price,
      discountPrice: course.discountPrice || 0,
      categoryId: course.categoryId || "",
      level: course.level as any,
      language: course.language,
      requirements: course.requirements?.join("\n") || "",
      objectives: course.whatYouLearn?.join("\n") || "",
      targetAudience: "",
    },
  })

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId]
    )
  }

  const onSubmit = async (data: CourseFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/instructor/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error("Failed to update course")

      toast.success(t("courseSaved"))
      router.refresh()
    } catch (error) {
      toast.error(t("saveFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  const handlePublish = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/instructor/courses/${course.id}/publish`,
        { method: "POST" }
      )

      if (!response.ok) {
        const data = await response.json()
        // Show Arabic errors if available
        if (data.errorsAr && data.errorsAr.length > 0) {
          data.errorsAr.forEach((err: string) => toast.error(err))
        } else if (data.errors && data.errors.length > 0) {
          data.errors.forEach((err: string) => toast.error(err))
        } else {
          toast.error(t("publishFailed"))
        }
        return
      }

      toast.success(t("coursePublished"))
      router.refresh()
    } catch (error) {
      toast.error(t("publishFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddChapter = async (data: {
    title: string
    titleAr?: string
  }) => {
    try {
      const response = await fetch(
        `/api/instructor/courses/${course.id}/chapters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            position: chapters.length,
          }),
        }
      )

      if (!response.ok) throw new Error("Failed to add chapter")

      const newChapter = await response.json()
      setChapters([...chapters, { ...newChapter, lessons: [] }])
      setIsAddingChapter(false)
      toast.success(t("chapterAdded"))
    } catch (error) {
      toast.error(t("addFailed"))
    }
  }

  const handleUpdateChapter = async (
    chapterId: string,
    data: { title: string; titleAr?: string; isPublished: boolean }
  ) => {
    try {
      const response = await fetch(
        `/api/instructor/courses/${course.id}/chapters/${chapterId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) throw new Error("Failed to update chapter")

      setChapters(
        chapters.map((ch) => (ch.id === chapterId ? { ...ch, ...data } : ch))
      )
      setEditingChapter(null)
      toast.success(t("chapterUpdated"))
    } catch (error) {
      toast.error(t("updateFailed"))
    }
  }

  const handleDeleteChapter = async (chapterId: string) => {
    if (!confirm(t("confirmDeleteChapter"))) return

    try {
      const response = await fetch(
        `/api/instructor/courses/${course.id}/chapters/${chapterId}`,
        { method: "DELETE" }
      )

      if (!response.ok) throw new Error("Failed to delete chapter")

      setChapters(chapters.filter((ch) => ch.id !== chapterId))
      toast.success(t("chapterDeleted"))
    } catch (error) {
      toast.error(t("deleteFailed"))
    }
  }

  const handleAddLesson = async (
    chapterId: string,
    data: {
      title: string
      titleAr?: string
      type: string
      videoUrl?: string
      content?: string
      duration?: number
      isFree: boolean
    }
  ) => {
    try {
      const chapter = chapters.find((ch) => ch.id === chapterId)
      const response = await fetch(
        `/api/instructor/courses/${course.id}/chapters/${chapterId}/lessons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            position: chapter?.lessons.length || 0,
          }),
        }
      )

      if (!response.ok) throw new Error("Failed to add lesson")

      const newLesson = await response.json()
      setChapters(
        chapters.map((ch) =>
          ch.id === chapterId
            ? { ...ch, lessons: [...ch.lessons, newLesson] }
            : ch
        )
      )
      setIsAddingLesson(null)
      toast.success(t("lessonAdded"))
    } catch (error) {
      toast.error(t("addFailed"))
    }
  }

  const handleUpdateLesson = async (
    chapterId: string,
    lessonId: string,
    data: any
  ) => {
    try {
      const response = await fetch(
        `/api/instructor/courses/${course.id}/chapters/${chapterId}/lessons/${lessonId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) throw new Error("Failed to update lesson")

      setChapters(
        chapters.map((ch) =>
          ch.id === chapterId
            ? {
                ...ch,
                lessons: ch.lessons.map((l) =>
                  l.id === lessonId ? { ...l, ...data } : l
                ),
              }
            : ch
        )
      )
      setEditingLesson(null)
      toast.success(t("lessonUpdated"))
    } catch (error) {
      toast.error(t("updateFailed"))
    }
  }

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!confirm(t("confirmDeleteLesson"))) return

    try {
      const response = await fetch(
        `/api/instructor/courses/${course.id}/chapters/${chapterId}/lessons/${lessonId}`,
        { method: "DELETE" }
      )

      if (!response.ok) throw new Error("Failed to delete lesson")

      setChapters(
        chapters.map((ch) =>
          ch.id === chapterId
            ? { ...ch, lessons: ch.lessons.filter((l) => l.id !== lessonId) }
            : ch
        )
      )
      toast.success(t("lessonDeleted"))
    } catch (error) {
      toast.error(t("deleteFailed"))
    }
  }

  // Handle thumbnail upload
  const handleThumbnailUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingThumbnail(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "thumbnails")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.errorAr || data.error || "Upload failed")
      }

      const data = await response.json()
      setThumbnail(data.url)

      // Update course with new thumbnail
      await fetch(`/api/instructor/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: data.url }),
      })

      toast.success(t("thumbnailUploaded") || "تم رفع الصورة بنجاح")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || t("uploadFailed") || "فشل رفع الصورة")
    } finally {
      setIsUploadingThumbnail(false)
    }
  }

  // Handle preview video save
  const handlePreviewVideoSave = async () => {
    try {
      await fetch(`/api/instructor/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoVideo: previewVideo }),
      })
      toast.success(t("videoSaved") || "تم حفظ الفيديو")
      router.refresh()
    } catch (error) {
      toast.error(t("saveFailed") || "فشل الحفظ")
    }
  }

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "VIDEO":
        return <Video className="h-4 w-4" />
      case "ARTICLE":
        return <FileText className="h-4 w-4" />
      case "QUIZ":
        return <FileQuestion className="h-4 w-4" />
      default:
        return <Video className="h-4 w-4" />
    }
  }

  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0)
  const publishedLessons = chapters.reduce(
    (sum, ch) => sum + ch.lessons.filter((l) => l.isPublished).length,
    0
  )

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/instructor/courses">
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {course.titleAr || course.titleEn}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={
                  course.status === "PUBLISHED" ? "default" : "secondary"
                }
              >
                {course.status === "PUBLISHED"
                  ? t("published")
                  : course.status === "DRAFT"
                  ? t("draft")
                  : course.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {chapters.length} {t("chaptersCount")} • {totalLessons}{" "}
                {t("lessonsCount")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/courses/${course.slug}`} target="_blank">
              <Eye className="ml-2 h-4 w-4" />
              {t("preview")}
            </Link>
          </Button>
          {course.status !== "PUBLISHED" && (
            <Button onClick={handlePublish} disabled={isLoading}>
              {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {t("publish")}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="details" className="gap-2">
            <Settings className="h-4 w-4" />
            {t("details")}
          </TabsTrigger>
          <TabsTrigger value="curriculum" className="gap-2">
            <Layers className="h-4 w-4" />
            {t("curriculum")}
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-2">
            <Upload className="h-4 w-4" />
            {t("media")}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("basicInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("titleEn")}</Label>
                    <Input {...register("title")} />
                    {errors.title && (
                      <p className="text-sm text-destructive">
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("titleAr")}</Label>
                    <Input {...register("titleAr")} dir="rtl" />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("descriptionEn")}</Label>
                    <Textarea {...register("description")} rows={4} />
                    {errors.description && (
                      <p className="text-sm text-destructive">
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("descriptionAr")}</Label>
                    <Textarea
                      {...register("descriptionAr")}
                      rows={4}
                      dir="rtl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("shortDescriptionEn")}</Label>
                    <Textarea {...register("shortDescription")} rows={2} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("shortDescriptionAr")}</Label>
                    <Textarea
                      {...register("shortDescriptionAr")}
                      rows={2}
                      dir="rtl"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("price")}</Label>
                      <Input
                        type="number"
                        {...register("price", { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("discountPrice")}</Label>
                      <Input
                        type="number"
                        {...register("discountPrice", { valueAsNumber: true })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("category")}</Label>
                    <Select
                      value={watch("categoryId")}
                      onValueChange={(v) => setValue("categoryId", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nameAr || cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.categoryId && (
                      <p className="text-sm text-destructive">
                        {errors.categoryId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("level")}</Label>
                    <Select
                      value={watch("level")}
                      onValueChange={(v: any) => setValue("level", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BEGINNER">
                          {t("beginner")}
                        </SelectItem>
                        <SelectItem value="INTERMEDIATE">
                          {t("intermediate")}
                        </SelectItem>
                        <SelectItem value="ADVANCED">
                          {t("advanced")}
                        </SelectItem>
                        <SelectItem value="ALL_LEVELS">
                          {t("allLevels")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("language")}</Label>
                    <Select
                      value={watch("language")}
                      onValueChange={(v) => setValue("language", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">{t("arabic")}</SelectItem>
                        <SelectItem value="en">{t("english")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("requirements")}</Label>
                    <Textarea {...register("requirements")} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("objectives")}</Label>
                    <Textarea {...register("objectives")} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("targetAudience")}</Label>
                    <Textarea {...register("targetAudience")} rows={3} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Save className="ml-2 h-4 w-4" />
                {t("saveChanges")}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Curriculum Tab */}
        <TabsContent value="curriculum">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("curriculum")}</CardTitle>
              <Dialog open={isAddingChapter} onOpenChange={setIsAddingChapter}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    {t("addChapter")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("addChapter")}</DialogTitle>
                  </DialogHeader>
                  <ChapterEditor
                    onSave={handleAddChapter}
                    onCancel={() => setIsAddingChapter(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {chapters.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("noChapters")}</p>
                  <p className="text-sm">{t("addFirstChapter")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chapters.map((chapter, chapterIndex) => (
                    <div
                      key={chapter.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Chapter Header */}
                      <div className="flex items-center gap-3 p-4 bg-muted/50">
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />

                        <button
                          onClick={() => toggleChapter(chapter.id)}
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          {expandedChapters.includes(chapter.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            {chapterIndex + 1}.{" "}
                            {chapter.titleAr || chapter.titleEn}
                          </span>
                          <Badge variant="outline" className="mr-2">
                            {chapter.lessons.length} {t("lessons")}
                          </Badge>
                          {!chapter.isPublished && (
                            <Badge variant="secondary">{t("draft")}</Badge>
                          )}
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingChapter(chapter)}
                            >
                              <Edit className="ml-2 h-4 w-4" />
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteChapter(chapter.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="ml-2 h-4 w-4" />
                              {t("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Lessons */}
                      {expandedChapters.includes(chapter.id) && (
                        <div className="divide-y">
                          {chapter.lessons.map((lesson, lessonIndex) => (
                            <div
                              key={lesson.id}
                              className="flex items-center gap-3 p-3 pr-4 hover:bg-muted/30"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move mr-4" />

                              <div className="flex items-center gap-2 flex-1">
                                {getLessonIcon(lesson.type || "VIDEO")}
                                <span className="text-sm">
                                  {chapterIndex + 1}.{lessonIndex + 1}{" "}
                                  {lesson.titleAr || lesson.titleEn}
                                </span>
                                {lesson.isFree && (
                                  <Badge variant="outline" className="text-xs">
                                    {t("free")}
                                  </Badge>
                                )}
                                {!lesson.isPublished && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {t("draft")}
                                  </Badge>
                                )}
                              </div>

                              {lesson.videoDuration &&
                                lesson.videoDuration > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {Math.floor(lesson.videoDuration / 60)}:
                                    {(lesson.videoDuration % 60)
                                      .toString()
                                      .padStart(2, "0")}
                                  </span>
                                )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setEditingLesson({
                                        lesson,
                                        chapterId: chapter.id,
                                      })
                                    }
                                  >
                                    <Edit className="me-2 h-4 w-4" />
                                    {t("edit")}
                                  </DropdownMenuItem>
                                  {lesson.type === "QUIZ" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setEditingQuiz({
                                          lessonId: lesson.id,
                                          chapterId: chapter.id,
                                        })
                                      }
                                    >
                                      <FileQuestion className="me-2 h-4 w-4" />
                                      {t("editQuiz") || "تعديل الاختبار"}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDeleteLesson(chapter.id, lesson.id)
                                    }
                                    className="text-destructive"
                                  >
                                    <Trash2 className="me-2 h-4 w-4" />
                                    {t("delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}

                          {/* Add Lesson Button */}
                          <Dialog
                            open={isAddingLesson === chapter.id}
                            onOpenChange={(open) =>
                              setIsAddingLesson(open ? chapter.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <button className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2">
                                <Plus className="h-4 w-4" />
                                {t("addLesson")}
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{t("addLesson")}</DialogTitle>
                              </DialogHeader>
                              <LessonEditor
                                onSave={(data) =>
                                  handleAddLesson(chapter.id, data)
                                }
                                onCancel={() => setIsAddingLesson(null)}
                              />
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>{t("mediaAssets")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Thumbnail */}
              <div className="space-y-4">
                <Label>{t("thumbnail")}</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {thumbnail ? (
                    <div className="relative">
                      <img
                        src={thumbnail}
                        alt="Thumbnail"
                        className="max-w-xs mx-auto rounded"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 end-2"
                        onClick={() => setThumbnail(null)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Upload className="h-10 w-10 mx-auto mb-2" />
                      <p>{t("uploadThumbnail")}</p>
                      <p className="text-xs">{t("thumbnailSize")}</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    id="thumbnail-upload"
                    onChange={handleThumbnailUpload}
                    disabled={isUploadingThumbnail}
                  />
                  <Button
                    variant="outline"
                    className="mt-4"
                    disabled={isUploadingThumbnail}
                    onClick={() =>
                      document.getElementById("thumbnail-upload")?.click()
                    }
                  >
                    {isUploadingThumbnail ? (
                      <>
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        {t("uploading") || "جاري الرفع..."}
                      </>
                    ) : (
                      t("uploadImage") || "رفع صورة"
                    )}
                  </Button>
                </div>
              </div>

              {/* Preview Video */}
              <div className="space-y-4">
                <Label>{t("previewVideo")}</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("videoUrlPlaceholder")}
                      value={previewVideo}
                      onChange={(e) => setPreviewVideo(e.target.value)}
                    />
                    <Button onClick={handlePreviewVideoSave}>
                      {t("save") || "حفظ"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("videoUrlHint")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Chapter Dialog */}
      <Dialog
        open={!!editingChapter}
        onOpenChange={() => setEditingChapter(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editChapter")}</DialogTitle>
          </DialogHeader>
          {editingChapter && (
            <ChapterEditor
              chapter={editingChapter}
              onSave={(data) =>
                handleUpdateChapter(editingChapter.id, {
                  ...data,
                  isPublished: editingChapter.isPublished,
                })
              }
              onCancel={() => setEditingChapter(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lesson Dialog */}
      <Dialog
        open={!!editingLesson}
        onOpenChange={() => setEditingLesson(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editLesson")}</DialogTitle>
          </DialogHeader>
          {editingLesson && (
            <LessonEditor
              lesson={editingLesson.lesson}
              onSave={(data) =>
                handleUpdateLesson(
                  editingLesson.chapterId,
                  editingLesson.lesson.id,
                  data
                )
              }
              onCancel={() => setEditingLesson(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Quiz Dialog */}
      <Dialog open={!!editingQuiz} onOpenChange={() => setEditingQuiz(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("editQuiz") || "تعديل الاختبار"}</DialogTitle>
          </DialogHeader>
          {editingQuiz && (
            <QuizEditor
              lessonId={editingQuiz.lessonId}
              courseId={course.id}
              onSave={() => {
                setEditingQuiz(null)
                router.refresh()
              }}
              onCancel={() => setEditingQuiz(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
