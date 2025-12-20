"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"

interface ChapterEditorProps {
  chapter?: {
    id: string
    titleEn: string
    titleAr?: string
    isPublished: boolean
  }
  onSave: (data: {
    title: string
    titleAr?: string
    isPublished?: boolean
  }) => void
  onCancel: () => void
}

export function ChapterEditor({
  chapter,
  onSave,
  onCancel,
}: ChapterEditorProps) {
  const t = useTranslations("instructor")
  const [isLoading, setIsLoading] = useState(false)
  const [title, setTitle] = useState(chapter?.titleEn || "")
  const [titleAr, setTitleAr] = useState(chapter?.titleAr || "")
  const [isPublished, setIsPublished] = useState(chapter?.isPublished || false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsLoading(true)
    try {
      await onSave({ title, titleAr, isPublished })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("chapterTitleEn")}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("chapterTitlePlaceholder")}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t("chapterTitleAr")}</Label>
        <Input
          value={titleAr}
          onChange={(e) => setTitleAr(e.target.value)}
          placeholder={t("chapterTitleArPlaceholder")}
          dir="rtl"
        />
      </div>

      {chapter && (
        <div className="flex items-center justify-between">
          <Label>{t("published")}</Label>
          <Switch checked={isPublished} onCheckedChange={setIsPublished} />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isLoading || !title.trim()}>
          {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {chapter ? t("update") : t("add")}
        </Button>
      </div>
    </form>
  )
}
