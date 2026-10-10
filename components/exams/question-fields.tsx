"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle, ImageIcon, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  EXAM_QUESTION_TYPES,
  type EditorQuestion,
  type ExamQuestionType,
  isHttpUrl,
  optionsForType,
  tempId,
} from "./types"

interface QuestionFieldsProps {
  question: EditorQuestion
  /** 0-based position shown as "Question n"; omit to hide the header */
  index?: number
  onChange: (next: EditorQuestion) => void
  onRemove?: () => void
  /** Extra buttons in the header (e.g. "Save to bank") */
  actions?: ReactNode
}

const MAX_OPTIONS = 8

/** Editor for one question of any type; shared by the quiz editor and the question bank. */
export function QuestionFields({ question, index, onChange, onRemove, actions }: QuestionFieldsProps) {
  const t = useTranslations("exams")
  const set = (patch: Partial<EditorQuestion>) => onChange({ ...question, ...patch })
  const imageUrl = question.imageUrl?.trim() ?? ""
  const imageInvalid = !!imageUrl && !isHttpUrl(imageUrl)

  const setType = (type: ExamQuestionType) => set({ type, options: optionsForType(question, type) })

  const setOption = (i: number, patch: Partial<EditorQuestion["options"][number]>) => {
    const options = question.options.map((o, j) => (j === i ? { ...o, ...patch } : o))
    set({ options })
  }

  const markCorrect = (i: number) => {
    if (question.type === "MULTIPLE_SELECT") {
      setOption(i, { isCorrect: !question.options[i].isCorrect })
    } else {
      set({ options: question.options.map((o, j) => ({ ...o, isCorrect: j === i })) })
    }
  }

  const addOption = () =>
    set({ options: [...question.options, { id: tempId("opt"), text: "", textAr: "", isCorrect: false }] })

  const removeOption = (i: number) => {
    const options = question.options.filter((_, j) => j !== i)
    if (question.type === "MULTIPLE_CHOICE" && !options.some((o) => o.isCorrect) && options[0]) {
      options[0] = { ...options[0], isCorrect: true }
    }
    set({ options })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {(index !== undefined || onRemove || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {index !== undefined && (
            <span className="font-medium">{t("question.number", { number: index + 1 })}</span>
          )}
          <div className="ms-auto flex flex-wrap items-center gap-1">
            {actions}
            {onRemove && (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={t("question.remove")}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-2">
          <Label>{t("question.type")}</Label>
          <Select value={question.type} onValueChange={(v) => setType(v as ExamQuestionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXAM_QUESTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("question.points")}</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={question.points}
            onChange={(e) => set({ points: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("question.textAr")}</Label>
          <Textarea
            value={question.questionAr ?? ""}
            onChange={(e) => set({ questionAr: e.target.value })}
            dir="rtl"
            rows={2}
            placeholder={t("question.textPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("question.textEn")}</Label>
          <Textarea
            value={question.question}
            onChange={(e) => set({ question: e.target.value })}
            dir="ltr"
            rows={2}
            placeholder={t("question.textPlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          {t("question.imageUrl")}
        </Label>
        <Input
          type="url"
          dir="ltr"
          value={question.imageUrl ?? ""}
          onChange={(e) => set({ imageUrl: e.target.value })}
          placeholder="https://…"
          aria-invalid={imageInvalid}
        />
        {imageInvalid ? (
          <p className="text-xs text-destructive">{t("errors.imageUrlInvalid")}</p>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="max-h-40 max-w-full rounded-md border object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t("question.imageHint")}</p>
        )}
      </div>

      {question.type === "ESSAY" ? (
        <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{t("question.essayHint")}</p>
      ) : question.type === "TRUE_FALSE" ? (
        <div className="space-y-2">
          <Label>{t("question.correctAnswer")}</Label>
          <Select
            value={String(Math.max(0, question.options.findIndex((o) => o.isCorrect)))}
            onValueChange={(v) => markCorrect(parseInt(v))}
          >
            <SelectTrigger className="sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t("question.true")}</SelectItem>
              <SelectItem value="1">{t("question.false")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <Label>
            {question.type === "MULTIPLE_SELECT" ? t("question.optionsMulti") : t("question.optionsSingle")}
          </Label>
          {question.options.map((option, i) => (
            <div key={option.id} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <button
                type="button"
                className={cn(
                  "shrink-0 rounded-full border-2 p-2 transition-colors",
                  option.isCorrect
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-muted hover:border-green-500"
                )}
                onClick={() => markCorrect(i)}
                title={t("question.markCorrect")}
                aria-label={t("question.markCorrect")}
                aria-pressed={option.isCorrect}
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <Input
                value={option.textAr ?? ""}
                onChange={(e) => setOption(i, { textAr: e.target.value })}
                placeholder={t("question.optionAr", { number: i + 1 })}
                dir="rtl"
                className="min-w-0 flex-1 basis-40"
              />
              <Input
                value={option.text}
                onChange={(e) => setOption(i, { text: e.target.value })}
                placeholder={t("question.optionEn", { number: i + 1 })}
                dir="ltr"
                className="min-w-0 flex-1 basis-40"
              />
              {question.options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeOption(i)}
                  aria-label={t("question.removeOption")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {question.options.length < MAX_OPTIONS && (
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="me-2 h-4 w-4" />
              {t("question.addOption")}
            </Button>
          )}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          {t("question.explanation")}
        </summary>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <Textarea
            value={question.explanationAr ?? ""}
            onChange={(e) => set({ explanationAr: e.target.value })}
            dir="rtl"
            rows={2}
            placeholder={t("question.explanationAr")}
          />
          <Textarea
            value={question.explanation ?? ""}
            onChange={(e) => set({ explanation: e.target.value })}
            dir="ltr"
            rows={2}
            placeholder={t("question.explanationEn")}
          />
        </div>
      </details>
    </div>
  )
}
