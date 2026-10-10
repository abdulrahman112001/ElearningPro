"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Clock, Loader2, Plus, ShieldAlert, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuestionFields } from "@/components/exams/question-fields"
import { QuestionBankPicker } from "@/components/exams/question-bank-picker"
import { SaveToBankButton } from "@/components/exams/save-to-bank-button"
import { cairoInputToIso, isoToCairoInput } from "@/components/exams/cairo-time"
import {
  blankQuestion,
  questionPayload,
  questionProblem,
  toEditorQuestion,
  type EditorQuestion,
} from "@/components/exams/types"
import { GenerateQuestionsDialog, type GeneratedQuestion } from "@/components/ai/generate-questions-dialog"

interface ExistingQuiz {
  id: string
  title: string
  titleAr?: string | null
  description?: string | null
  passingScore: number
  timeLimit?: number | null
  shuffleQuestions: boolean
  showResults?: boolean
  availableFrom?: string | null
  availableUntil?: string | null
  maxAttempts?: number | null
  questionsPerAttempt?: number | null
  detectTabSwitch?: boolean
  questions: any[]
}

interface QuizEditorProps {
  lessonId: string
  courseId: string
  /** When omitted the editor loads the lesson's quiz itself (if any). */
  existingQuiz?: ExistingQuiz
  onSave: () => void
  onCancel: () => void
}

interface Settings {
  title: string
  titleAr: string
  description: string
  passingScore: number
  timeLimit: string
  shuffleQuestions: boolean
  showResults: boolean
  availableFrom: string
  availableUntil: string
  maxAttempts: string
  questionsPerAttempt: string
  detectTabSwitch: boolean
}

function settingsFrom(q?: ExistingQuiz): Settings {
  return {
    title: q?.title ?? "",
    titleAr: q?.titleAr ?? "",
    description: q?.description ?? "",
    passingScore: q?.passingScore ?? 70,
    timeLimit: q ? (q.timeLimit ? String(q.timeLimit) : "") : "30",
    shuffleQuestions: q?.shuffleQuestions ?? false,
    showResults: q?.showResults ?? true,
    availableFrom: isoToCairoInput(q?.availableFrom),
    availableUntil: isoToCairoInput(q?.availableUntil),
    maxAttempts: q?.maxAttempts ? String(q.maxAttempts) : "",
    questionsPerAttempt: q?.questionsPerAttempt ? String(q.questionsPerAttempt) : "",
    detectTabSwitch: q?.detectTabSwitch ?? true,
  }
}

const optionalInt = (v: string) => {
  const n = parseInt(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function QuizEditor({ lessonId, courseId, existingQuiz, onSave, onCancel }: QuizEditorProps) {
  const t = useTranslations("instructor")
  const te = useTranslations("exams")
  const tq = useTranslations("quizEditor")
  const [isLoading, setIsLoading] = useState(false)
  const [loaded, setLoaded] = useState<boolean>(!!existingQuiz)
  const [quizExists, setQuizExists] = useState<boolean>(!!existingQuiz)
  const [settings, setSettings] = useState<Settings>(settingsFrom(existingQuiz))
  const [questions, setQuestions] = useState<EditorQuestion[]>(
    existingQuiz?.questions.map((q) => toEditorQuestion(q, true)) ?? []
  )

  // Load the lesson's quiz when the caller did not pass it.
  useEffect(() => {
    if (existingQuiz) return
    let cancelled = false
    fetch(`/api/instructor/courses/${courseId}/lessons/${lessonId}/quiz`)
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) {
          const quiz = (await res.json()) as ExistingQuiz
          if (cancelled) return
          setSettings(settingsFrom(quiz))
          setQuestions(quiz.questions.map((q) => toEditorQuestion(q, true)))
          setQuizExists(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [existingQuiz, courseId, lessonId])

  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))
  const append = (more: EditorQuestion[]) => {
    if (more.length === 0) return
    setQuestions((qs) => [...qs, ...more])
    toast.success(te("editor.questionsAdded", { count: more.length }))
  }
  const insertGenerated = (generated: GeneratedQuestion[]) => append(generated.map((g) => toEditorQuestion(g)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!settings.title.trim() && !settings.titleAr.trim()) {
      toast.error(t("titleRequired"))
      return
    }
    if (questions.length === 0) {
      toast.error(t("addAtLeastOneQuestion"))
      return
    }
    for (let i = 0; i < questions.length; i++) {
      const problem = questionProblem(questions[i])
      if (problem) {
        toast.error(`${te("question.number", { number: i + 1 })}: ${te(problem)}`)
        return
      }
    }
    const availableFrom = cairoInputToIso(settings.availableFrom)
    const availableUntil = cairoInputToIso(settings.availableUntil)
    if (availableFrom && availableUntil && availableUntil <= availableFrom) {
      toast.error(te("errors.windowOrder"))
      return
    }
    const questionsPerAttempt = optionalInt(settings.questionsPerAttempt)
    if (questionsPerAttempt && questionsPerAttempt > questions.length) {
      toast.error(te("errors.perAttemptTooMany", { count: questions.length }))
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        title: settings.title.trim() || settings.titleAr.trim(),
        titleAr: settings.titleAr.trim() || null,
        description: settings.description.trim() || null,
        passingScore: settings.passingScore,
        timeLimit: optionalInt(settings.timeLimit),
        shuffleQuestions: settings.shuffleQuestions,
        showResults: settings.showResults,
        availableFrom,
        availableUntil,
        maxAttempts: optionalInt(settings.maxAttempts),
        questionsPerAttempt,
        detectTabSwitch: settings.detectTabSwitch,
        questions: questions.map((q, index) => ({
          ...questionPayload(q),
          // Saved questions keep their id so past attempts keep their answers.
          id: q.id.startsWith("temp-") ? undefined : q.id,
          position: index,
        })),
      }

      const response = await fetch(`/api/instructor/courses/${courseId}/lessons/${lessonId}/quiz`, {
        method: quizExists ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || tq("saveFailed"))
      }

      toast.success(quizExists ? t("quizUpdated") : t("quizCreated"))
      onSave()
    } catch (error: any) {
      toast.error(error.message || tq("saveFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-6 overflow-y-auto pe-2">
      {/* Quiz settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("quizSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("titleAr")}</Label>
              <Input
                value={settings.titleAr}
                onChange={(e) => set({ titleAr: e.target.value })}
                dir="rtl"
                placeholder={tq("titlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("titleEn")}</Label>
              <Input
                value={settings.title}
                onChange={(e) => set({ title: e.target.value })}
                dir="ltr"
                placeholder={tq("titlePlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("description")}</Label>
            <Textarea
              value={settings.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder={t("quizDescriptionPlaceholder")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("passingScore")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.passingScore}
                onChange={(e) =>
                  set({ passingScore: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("timeLimit")}</Label>
              <Input
                type="number"
                min={1}
                value={settings.timeLimit}
                onChange={(e) => set({ timeLimit: e.target.value })}
                placeholder={te("editor.unlimited")}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <label className="flex items-center gap-3">
              <Switch checked={settings.shuffleQuestions} onCheckedChange={(v) => set({ shuffleQuestions: v })} />
              <span className="text-sm font-medium">{t("shuffleQuestions")}</span>
            </label>
            <label className="flex items-center gap-3">
              <Switch checked={settings.showResults} onCheckedChange={(v) => set({ showResults: v })} />
              <span className="text-sm font-medium">{te("editor.showResults")}</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Exam settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            {te("editor.examSettings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exam-from">{te("editor.availableFrom")}</Label>
              <Input
                id="exam-from"
                type="datetime-local"
                value={settings.availableFrom}
                onChange={(e) => set({ availableFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-until">{te("editor.availableUntil")}</Label>
              <Input
                id="exam-until"
                type="datetime-local"
                value={settings.availableUntil}
                onChange={(e) => set({ availableUntil: e.target.value })}
              />
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {te("editor.cairoTimeHint")}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{te("editor.maxAttempts")}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.maxAttempts}
                onChange={(e) => set({ maxAttempts: e.target.value })}
                placeholder={te("editor.unlimited")}
              />
            </div>
            <div className="space-y-2">
              <Label>{te("editor.questionsPerAttempt")}</Label>
              <Input
                type="number"
                min={1}
                max={questions.length || undefined}
                value={settings.questionsPerAttempt}
                onChange={(e) => set({ questionsPerAttempt: e.target.value })}
                placeholder={te("editor.allQuestions", { count: questions.length })}
              />
              <p className="text-xs text-muted-foreground">{te("editor.questionsPerAttemptHint")}</p>
            </div>
          </div>

          <label className="flex items-start gap-3">
            <Switch
              checked={settings.detectTabSwitch}
              onCheckedChange={(v) => set({ detectTabSwitch: v })}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">{te("editor.detectTabSwitch")}</span>
              <span className="block text-xs text-muted-foreground">{te("editor.detectTabSwitchHint")}</span>
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {t("questions")} <span className="text-sm font-normal text-muted-foreground">({questions.length})</span>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <GenerateQuestionsDialog
              lessonId={lessonId}
              courseId={courseId}
              onInsert={insertGenerated}
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <Sparkles className="me-2 h-4 w-4" />
                  {te("editor.generateWithAi")}
                </Button>
              }
            />
            <QuestionBankPicker onInsert={append} />
            <Button type="button" variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}>
              <Plus className="me-2 h-4 w-4" />
              {t("addQuestion")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>{t("noQuestions")}</p>
            </div>
          ) : (
            questions.map((question, qIndex) => (
              <QuestionFields
                key={question.id}
                question={question}
                index={qIndex}
                onChange={(next) => setQuestions((qs) => qs.map((q, i) => (i === qIndex ? next : q)))}
                onRemove={() => setQuestions((qs) => qs.filter((_, i) => i !== qIndex))}
                actions={<SaveToBankButton question={question} />}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {quizExists ? t("update") : t("create")}
        </Button>
      </div>
    </form>
  )
}
