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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, GripVertical, Loader2, CheckCircle } from "lucide-react"
import toast from "react-hot-toast"

interface QuizOption {
  id: string
  text: string
  textAr?: string
  isCorrect: boolean
}

interface QuizQuestion {
  id: string
  question: string
  questionAr?: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT"
  options: QuizOption[]
  explanation?: string
  explanationAr?: string
  points: number
}

interface QuizEditorProps {
  lessonId: string
  courseId: string
  existingQuiz?: {
    id: string
    title: string
    titleAr?: string
    description?: string
    passingScore: number
    timeLimit?: number
    shuffleQuestions: boolean
    questions: QuizQuestion[]
  }
  onSave: () => void
  onCancel: () => void
}

export function QuizEditor({
  lessonId,
  courseId,
  existingQuiz,
  onSave,
  onCancel,
}: QuizEditorProps) {
  const t = useTranslations("instructor")
  const tQuiz = useTranslations("quiz")
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: existingQuiz?.title || "",
    titleAr: existingQuiz?.titleAr || "",
    description: existingQuiz?.description || "",
    passingScore: existingQuiz?.passingScore || 70,
    timeLimit: existingQuiz?.timeLimit || 30,
    shuffleQuestions: existingQuiz?.shuffleQuestions || false,
  })

  const [questions, setQuestions] = useState<QuizQuestion[]>(
    existingQuiz?.questions || []
  )

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `temp-${Date.now()}`,
      question: "",
      questionAr: "",
      type: "MULTIPLE_CHOICE",
      options: [
        { id: `opt-${Date.now()}-0`, text: "", textAr: "", isCorrect: true },
        { id: `opt-${Date.now()}-1`, text: "", textAr: "", isCorrect: false },
        { id: `opt-${Date.now()}-2`, text: "", textAr: "", isCorrect: false },
        { id: `opt-${Date.now()}-3`, text: "", textAr: "", isCorrect: false },
      ],
      explanation: "",
      explanationAr: "",
      points: 1,
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }

    // If type changes, update options accordingly
    if (field === "type") {
      if (value === "TRUE_FALSE") {
        updated[index].options = [
          {
            id: `opt-${Date.now()}-0`,
            text: "True",
            textAr: "صح",
            isCorrect: true,
          },
          {
            id: `opt-${Date.now()}-1`,
            text: "False",
            textAr: "خطأ",
            isCorrect: false,
          },
        ]
      } else if (
        value === "MULTIPLE_CHOICE" &&
        updated[index].options.length < 4
      ) {
        // Ensure we have at least 4 options for multiple choice
        const existingOptions = updated[index].options
        updated[index].options = [
          ...existingOptions,
          ...Array(4 - existingOptions.length)
            .fill(null)
            .map((_, i) => ({
              id: `opt-${Date.now()}-${existingOptions.length + i}`,
              text: "",
              textAr: "",
              isCorrect: false,
            })),
        ]
      }
    }

    setQuestions(updated)
  }

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    field: "text" | "textAr" | "isCorrect",
    value: string | boolean
  ) => {
    const updated = [...questions]
    const options = [...updated[questionIndex].options]

    if (field === "isCorrect" && value === true) {
      // For MULTIPLE_CHOICE, only one can be correct
      if (updated[questionIndex].type === "MULTIPLE_CHOICE") {
        options.forEach((opt, i) => {
          options[i] = { ...opt, isCorrect: i === optionIndex }
        })
      } else {
        options[optionIndex] = { ...options[optionIndex], [field]: value }
      }
    } else {
      options[optionIndex] = { ...options[optionIndex], [field]: value }
    }

    updated[questionIndex].options = options
    setQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    if (!formData.title.trim()) {
      toast.error(t("titleRequired") || "العنوان مطلوب")
      return
    }

    if (questions.length === 0) {
      toast.error(t("addAtLeastOneQuestion") || "أضف سؤال واحد على الأقل")
      return
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question.trim()) {
        toast.error(
          `${t("question")} ${i + 1}: ${
            t("questionRequired") || "السؤال مطلوب"
          }`
        )
        return
      }
      if (
        q.type === "MULTIPLE_CHOICE" &&
        q.options.filter((o) => o.text.trim()).length < 2
      ) {
        toast.error(
          `${t("question")} ${i + 1}: ${
            t("addAtLeastTwoOptions") || "أضف خيارين على الأقل"
          }`
        )
        return
      }
      // Check that at least one option is correct
      if (!q.options.some((o) => o.isCorrect)) {
        toast.error(
          `${t("question")} ${i + 1}: ${
            t("selectCorrectAnswer") || "حدد الإجابة الصحيحة"
          }`
        )
        return
      }
    }

    setIsLoading(true)
    try {
      const payload = {
        title: formData.title,
        titleAr: formData.titleAr,
        description: formData.description,
        passingScore: formData.passingScore,
        timeLimit: formData.timeLimit || null,
        shuffleQuestions: formData.shuffleQuestions,
        questions: questions.map((q, index) => ({
          question: q.question,
          questionAr: q.questionAr,
          type: q.type,
          options: q.options.filter((o) => o.text.trim()), // JSON array with {id, text, textAr, isCorrect}
          explanation: q.explanation,
          explanationAr: q.explanationAr,
          points: q.points,
          position: index,
        })),
      }

      const url = `/api/instructor/courses/${courseId}/lessons/${lessonId}/quiz`

      const response = await fetch(url, {
        method: existingQuiz ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save quiz")
      }

      toast.success(
        existingQuiz
          ? t("quizUpdated") || "تم تحديث الاختبار"
          : t("quizCreated") || "تم إنشاء الاختبار"
      )
      onSave()
    } catch (error: any) {
      toast.error(error.message || t("saveFailed") || "فشل الحفظ")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-h-[70vh] overflow-y-auto pe-2"
    >
      {/* Quiz Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("quizSettings") || "إعدادات الاختبار"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("titleEn") || "العنوان (إنجليزي)"}</Label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Quiz Title"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("titleAr") || "العنوان (عربي)"}</Label>
              <Input
                value={formData.titleAr}
                onChange={(e) =>
                  setFormData({ ...formData, titleAr: e.target.value })
                }
                dir="rtl"
                placeholder="عنوان الاختبار"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("description") || "الوصف"}</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t("quizDescriptionPlaceholder") || "وصف الاختبار..."}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("passingScore") || "درجة النجاح (%)"}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.passingScore}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    passingScore: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("timeLimit") || "الوقت (دقائق)"}</Label>
              <Input
                type="number"
                min={1}
                value={formData.timeLimit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    timeLimit: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={formData.shuffleQuestions}
              onCheckedChange={(v) =>
                setFormData({ ...formData, shuffleQuestions: v })
              }
            />
            <Label>{t("shuffleQuestions") || "خلط الأسئلة عشوائياً"}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("questions") || "الأسئلة"}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addQuestion}
          >
            <Plus className="h-4 w-4 me-2" />
            {t("addQuestion") || "إضافة سؤال"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t("noQuestions") || "لا توجد أسئلة. أضف سؤالاً للبدء."}</p>
            </div>
          ) : (
            questions.map((question, qIndex) => (
              <Card key={question.id} className="border">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <span className="font-medium">
                      {t("question")} {qIndex + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(qIndex)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {/* Question Type */}
                  <div className="space-y-2">
                    <Label>{t("questionType") || "نوع السؤال"}</Label>
                    <Select
                      value={question.type}
                      onValueChange={(v: any) =>
                        updateQuestion(qIndex, "type", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MULTIPLE_CHOICE">
                          {tQuiz("multipleChoice") || "اختيار من متعدد"}
                        </SelectItem>
                        <SelectItem value="TRUE_FALSE">
                          {tQuiz("trueFalse") || "صح / خطأ"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Question Text */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("questionEn") || "السؤال (إنجليزي)"}</Label>
                      <Textarea
                        value={question.question}
                        onChange={(e) =>
                          updateQuestion(qIndex, "question", e.target.value)
                        }
                        placeholder="Enter question..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("questionAr") || "السؤال (عربي)"}</Label>
                      <Textarea
                        value={question.questionAr}
                        onChange={(e) =>
                          updateQuestion(qIndex, "questionAr", e.target.value)
                        }
                        dir="rtl"
                        placeholder="أدخل السؤال..."
                      />
                    </div>
                  </div>

                  {/* Options for Multiple Choice */}
                  {question.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-3">
                      <Label>{t("options") || "الخيارات"}</Label>
                      {question.options.map((option, oIndex) => (
                        <div
                          key={option.id}
                          className="flex items-center gap-2"
                        >
                          <button
                            type="button"
                            className={`p-2 rounded-full border-2 transition-colors ${
                              option.isCorrect
                                ? "border-green-500 bg-green-500 text-white"
                                : "border-muted hover:border-green-500"
                            }`}
                            onClick={() =>
                              updateOption(qIndex, oIndex, "isCorrect", true)
                            }
                            title={t("markAsCorrect") || "تحديد كإجابة صحيحة"}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <Input
                            value={option.text}
                            onChange={(e) =>
                              updateOption(
                                qIndex,
                                oIndex,
                                "text",
                                e.target.value
                              )
                            }
                            placeholder={`${t("option") || "الخيار"} ${
                              oIndex + 1
                            } (EN)`}
                            className="flex-1"
                          />
                          <Input
                            value={option.textAr || ""}
                            onChange={(e) =>
                              updateOption(
                                qIndex,
                                oIndex,
                                "textAr",
                                e.target.value
                              )
                            }
                            placeholder={`${t("option") || "الخيار"} ${
                              oIndex + 1
                            } (AR)`}
                            dir="rtl"
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Options for True/False */}
                  {question.type === "TRUE_FALSE" && (
                    <div className="space-y-2">
                      <Label>{t("correctAnswer") || "الإجابة الصحيحة"}</Label>
                      <Select
                        value={question.options
                          .findIndex((o) => o.isCorrect)
                          .toString()}
                        onValueChange={(v) => {
                          const updated = [...questions]
                          const opts = updated[qIndex].options.map((o, i) => ({
                            ...o,
                            isCorrect: i === parseInt(v),
                          }))
                          updated[qIndex].options = opts
                          setQuestions(updated)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">
                            {tQuiz("true") || "صح"}
                          </SelectItem>
                          <SelectItem value="1">
                            {tQuiz("false") || "خطأ"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Points */}
                  <div className="space-y-2 w-32">
                    <Label>{t("points") || "النقاط"}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={question.points}
                      onChange={(e) =>
                        updateQuestion(
                          qIndex,
                          "points",
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel") || "إلغاء"}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {existingQuiz ? t("update") || "تحديث" : t("create") || "إنشاء"}
        </Button>
      </div>
    </form>
  )
}
