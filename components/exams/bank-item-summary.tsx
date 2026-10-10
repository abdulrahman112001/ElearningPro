"use client"

import { useLocale, useTranslations } from "next-intl"
import { ImageIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GradeLevel } from "./bank-filters"

export interface BankItem {
  id: string
  question: string
  questionAr: string | null
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT" | "ESSAY"
  options: { id: string; text: string; textAr?: string | null; isCorrect: boolean }[]
  explanation: string | null
  explanationAr: string | null
  imageUrl: string | null
  points: number
  subject: string | null
  gradeLevelId: string | null
  tags: string[]
  difficulty: string | null
  createdAt: string
}

/** Compact read-only view of a bank question (text, type, classification). */
export function BankItemSummary({ item, grades }: { item: BankItem; grades: GradeLevel[] }) {
  const t = useTranslations("exams")
  const locale = useLocale()
  const text = locale === "ar" ? item.questionAr || item.question : item.question || item.questionAr
  const grade = grades.find((g) => g.id === item.gradeLevelId)
  return (
    <div className="min-w-0 space-y-2">
      <p className="line-clamp-3 whitespace-pre-line text-sm font-medium leading-relaxed" dir="auto">
        {text}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="secondary">{t(`types.${item.type}`)}</Badge>
        {item.difficulty && <Badge variant="outline">{t(`difficulty.${item.difficulty}`)}</Badge>}
        <Badge variant="outline">{t("question.pointsCount", { count: item.points })}</Badge>
        {item.subject && <Badge variant="outline">{item.subject}</Badge>}
        {grade && <Badge variant="outline">{locale === "ar" ? grade.nameAr : grade.nameEn}</Badge>}
        {item.imageUrl && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" aria-label={t("question.hasImage")} />}
        {item.tags.map((tag) => (
          <span key={tag} className="text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  )
}
