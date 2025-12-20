"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Video, FileText, FileQuestion, Upload } from "lucide-react"

interface LessonEditorProps {
  lesson?: {
    id: string
    titleEn: string
    titleAr?: string
    descriptionEn?: string
    descriptionAr?: string
    type: string
    videoUrl?: string
    videoProvider?: string
    content?: string
    contentAr?: string
    videoDuration?: number
    isPublished: boolean
    isFree: boolean
  }
  onSave: (data: any) => void
  onCancel: () => void
}

export function LessonEditor({ lesson, onSave, onCancel }: LessonEditorProps) {
  const t = useTranslations("instructor")
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("basic")

  const [formData, setFormData] = useState({
    title: lesson?.titleEn || "",
    titleAr: lesson?.titleAr || "",
    description: lesson?.descriptionEn || "",
    descriptionAr: lesson?.descriptionAr || "",
    type: lesson?.type || "VIDEO",
    videoUrl: lesson?.videoUrl || "",
    videoProvider: lesson?.videoProvider || "YOUTUBE",
    content: lesson?.content || "",
    contentAr: lesson?.contentAr || "",
    duration: lesson?.videoDuration || 0,
    isPublished: lesson?.isPublished || false,
    isFree: lesson?.isFree || false,
  })

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setIsLoading(true)
    try {
      await onSave(formData)
    } finally {
      setIsLoading(false)
    }
  }

  const detectVideoProvider = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return "YOUTUBE"
    } else if (url.includes("vimeo.com")) {
      return "VIMEO"
    }
    return "OTHER"
  }

  const handleVideoUrlChange = (url: string) => {
    updateField("videoUrl", url)
    updateField("videoProvider", detectVideoProvider(url))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">{t("basicInfo")}</TabsTrigger>
          <TabsTrigger value="content">{t("content")}</TabsTrigger>
          <TabsTrigger value="settings">{t("settings")}</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4">
          <div className="space-y-2">
            <Label>{t("lessonType")}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={formData.type === "VIDEO" ? "default" : "outline"}
                className="h-20 flex-col gap-2"
                onClick={() => updateField("type", "VIDEO")}
              >
                <Video className="h-6 w-6" />
                <span>{t("video")}</span>
              </Button>
              <Button
                type="button"
                variant={formData.type === "ARTICLE" ? "default" : "outline"}
                className="h-20 flex-col gap-2"
                onClick={() => updateField("type", "ARTICLE")}
              >
                <FileText className="h-6 w-6" />
                <span>{t("article")}</span>
              </Button>
              <Button
                type="button"
                variant={formData.type === "QUIZ" ? "default" : "outline"}
                className="h-20 flex-col gap-2"
                onClick={() => updateField("type", "QUIZ")}
              >
                <FileQuestion className="h-6 w-6" />
                <span>{t("quiz")}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("lessonTitleEn")}</Label>
            <Input
              value={formData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder={t("lessonTitlePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("lessonTitleAr")}</Label>
            <Input
              value={formData.titleAr}
              onChange={(e) => updateField("titleAr", e.target.value)}
              placeholder={t("lessonTitleArPlaceholder")}
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("descriptionEn")}</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("descriptionAr")}</Label>
            <Textarea
              value={formData.descriptionAr}
              onChange={(e) => updateField("descriptionAr", e.target.value)}
              rows={3}
              dir="rtl"
            />
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          {formData.type === "VIDEO" && (
            <>
              <div className="space-y-2">
                <Label>{t("videoUrl")}</Label>
                <Input
                  value={formData.videoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                />
                <p className="text-xs text-muted-foreground">
                  {t("videoUrlHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("videoProvider")}</Label>
                <Select
                  value={formData.videoProvider}
                  onValueChange={(v) => updateField("videoProvider", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YOUTUBE">YouTube</SelectItem>
                    <SelectItem value="VIMEO">Vimeo</SelectItem>
                    <SelectItem value="UPLOAD">{t("uploadVideo")}</SelectItem>
                    <SelectItem value="OTHER">{t("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("duration")} ({t("seconds")})
                </Label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) =>
                    updateField("duration", parseInt(e.target.value) || 0)
                  }
                  min={0}
                />
              </div>

              {formData.videoProvider === "UPLOAD" && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {t("uploadVideoHint")}
                  </p>
                  <Button variant="outline" className="mt-3">
                    {t("selectFile")}
                  </Button>
                </div>
              )}
            </>
          )}

          {formData.type === "ARTICLE" && (
            <>
              <div className="space-y-2">
                <Label>{t("contentEn")}</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  rows={8}
                  placeholder={t("articleContentPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("contentAr")}</Label>
                <Textarea
                  value={formData.contentAr}
                  onChange={(e) => updateField("contentAr", e.target.value)}
                  rows={8}
                  dir="rtl"
                />
              </div>
            </>
          )}

          {formData.type === "QUIZ" && (
            <div className="p-6 text-center border rounded-lg bg-muted/50">
              <FileQuestion className="h-10 w-10 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">
                {t("quizLesson") || "درس اختبار"}
              </h4>
              <p className="text-muted-foreground text-sm mb-4">
                {t("quizLessonHint") ||
                  "سيتم إنشاء الاختبار بعد حفظ الدرس. يمكنك إضافة الأسئلة من صفحة تعديل الدرس."}
              </p>
              <ul className="text-start text-sm text-muted-foreground space-y-1 max-w-sm mx-auto">
                <li>✓ {t("quizFeature1") || "أسئلة اختيار من متعدد"}</li>
                <li>✓ {t("quizFeature2") || "أسئلة صح / خطأ"}</li>
                <li>✓ {t("quizFeature3") || "تحديد درجة النجاح والوقت"}</li>
                <li>✓ {t("quizFeature4") || "شهادة عند النجاح"}</li>
              </ul>
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base">{t("freePreview")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("freePreviewHint")}
              </p>
            </div>
            <Switch
              checked={formData.isFree}
              onCheckedChange={(v) => updateField("isFree", v)}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base">{t("publishLesson")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("publishLessonHint")}
              </p>
            </div>
            <Switch
              checked={formData.isPublished}
              onCheckedChange={(v) => updateField("isPublished", v)}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isLoading || !formData.title.trim()}>
          {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {lesson ? t("update") : t("add")}
        </Button>
      </div>
    </form>
  )
}
