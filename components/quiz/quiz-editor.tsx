"use client"

import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import toast from "react-hot-toast"
import { v4 as uuidv4 } from "uuid"
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  CheckCircle,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const optionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Option text is required"),
  textAr: z.string().optional(),
  isCorrect: z.boolean().default(false),
})

const questionSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1, "Question is required"),
  questionAr: z.string().optional(),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTIPLE_SELECT"]),
  options: z.array(optionSchema).min(2, "At least 2 options required"),
  explanation: z.string().optional(),
  explanationAr: z.string().optional(),
  points: z.number().min(1).default(1),
})

const quizSchema = z.object({
  title: z.string().min(1, "Title is required"),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimit: z.number().min(0).optional(),
  shuffleQuestions: z.boolean().default(false),
  showResults: z.boolean().default(true),
  questions: z.array(questionSchema).min(1, "At least 1 question required"),
})

type QuizFormData = z.infer<typeof quizSchema>

interface QuizEditorProps {
  lessonId: string
  initialData?: any
  onSuccess?: () => void
}

export function QuizEditor({
  lessonId,
  initialData,
  onSuccess,
}: QuizEditorProps) {
  const t = useTranslations("quiz")
  const locale = useLocale()
  const [saving, setSaving] = useState(false)

  const defaultQuestion = {
    id: uuidv4(),
    question: "",
    questionAr: "",
    type: "MULTIPLE_CHOICE" as const,
    options: [
      { id: uuidv4(), text: "", textAr: "", isCorrect: true },
      { id: uuidv4(), text: "", textAr: "", isCorrect: false },
      { id: uuidv4(), text: "", textAr: "", isCorrect: false },
      { id: uuidv4(), text: "", textAr: "", isCorrect: false },
    ],
    explanation: "",
    explanationAr: "",
    points: 1,
  }

  const form = useForm<QuizFormData>({
    resolver: zodResolver(quizSchema),
    defaultValues: initialData || {
      title: "",
      titleAr: "",
      description: "",
      passingScore: 70,
      timeLimit: undefined,
      shuffleQuestions: false,
      showResults: true,
      questions: [defaultQuestion],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  })

  const onSubmit = async (data: QuizFormData) => {
    setSaving(true)

    try {
      const response = await fetch(`/api/quizzes/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to save quiz")
      }

      toast.success(t("saved"))
      onSuccess?.()
    } catch (error) {
      toast.error(t("saveError"))
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () => {
    append(defaultQuestion)
  }

  const handleTypeChange = (index: number, type: string) => {
    const currentOptions = form.getValues(`questions.${index}.options`)

    if (type === "TRUE_FALSE") {
      form.setValue(`questions.${index}.options`, [
        { id: uuidv4(), text: "True", textAr: "صحيح", isCorrect: true },
        { id: uuidv4(), text: "False", textAr: "خطأ", isCorrect: false },
      ])
    } else if (currentOptions.length < 2) {
      form.setValue(`questions.${index}.options`, [
        { id: uuidv4(), text: "", textAr: "", isCorrect: true },
        { id: uuidv4(), text: "", textAr: "", isCorrect: false },
      ])
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Quiz Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("quizSettings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("title")} (EN)</FormLabel>
                    <FormControl>
                      <Input placeholder="Quiz title..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="titleAr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("title")} (AR)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="عنوان الاختبار..."
                        dir="rtl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Quiz description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="passingScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("passingScore")} (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("timeLimit")} ({t("minutes")})
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder={t("unlimited")}
                        {...field}
                        value={field.value || ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseInt(e.target.value)
                              : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t("timeLimitDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-6">
              <FormField
                control={form.control}
                name="shuffleQuestions"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      {t("shuffleQuestions")}
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showResults"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">{t("showResults")}</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t("questions")}</h3>
            <Button type="button" onClick={addQuestion} size="sm">
              <Plus className="me-2 h-4 w-4" />
              {t("addQuestion")}
            </Button>
          </div>

          <Accordion type="multiple" className="space-y-4">
            {fields.map((field, questionIndex) => (
              <AccordionItem
                key={field.id}
                value={field.id}
                className="border rounded-lg"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="outline">{questionIndex + 1}</Badge>
                    <span className="text-sm">
                      {form.watch(`questions.${questionIndex}.question`) ||
                        t("newQuestion")}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Question Type */}
                    <FormField
                      control={form.control}
                      name={`questions.${questionIndex}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("questionType")}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value)
                              handleTypeChange(questionIndex, value)
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MULTIPLE_CHOICE">
                                {t("multipleChoice")}
                              </SelectItem>
                              <SelectItem value="TRUE_FALSE">
                                {t("trueFalse")}
                              </SelectItem>
                              <SelectItem value="MULTIPLE_SELECT">
                                {t("multipleSelect")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    {/* Question Text */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`questions.${questionIndex}.question`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("question")} (EN)</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`questions.${questionIndex}.questionAr`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("question")} (AR)</FormLabel>
                            <FormControl>
                              <Textarea dir="rtl" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      <FormLabel>{t("options")}</FormLabel>
                      {form
                        .watch(`questions.${questionIndex}.options`)
                        ?.map((option: any, optionIndex: number) => (
                          <div
                            key={option.id}
                            className="flex items-start gap-3 p-3 border rounded-lg"
                          >
                            <Checkbox
                              checked={option.isCorrect}
                              onCheckedChange={(checked) => {
                                const type = form.getValues(
                                  `questions.${questionIndex}.type`
                                )
                                if (
                                  type === "MULTIPLE_CHOICE" ||
                                  type === "TRUE_FALSE"
                                ) {
                                  // Single correct answer
                                  const options = form.getValues(
                                    `questions.${questionIndex}.options`
                                  )
                                  options.forEach((_, idx) => {
                                    form.setValue(
                                      `questions.${questionIndex}.options.${idx}.isCorrect`,
                                      idx === optionIndex
                                    )
                                  })
                                } else {
                                  form.setValue(
                                    `questions.${questionIndex}.options.${optionIndex}.isCorrect`,
                                    checked as boolean
                                  )
                                }
                              }}
                              className="mt-3"
                            />
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Option (EN)"
                                value={option.text}
                                onChange={(e) =>
                                  form.setValue(
                                    `questions.${questionIndex}.options.${optionIndex}.text`,
                                    e.target.value
                                  )
                                }
                              />
                              <Input
                                placeholder="الخيار (AR)"
                                dir="rtl"
                                value={option.textAr || ""}
                                onChange={(e) =>
                                  form.setValue(
                                    `questions.${questionIndex}.options.${optionIndex}.textAr`,
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            {form.watch(`questions.${questionIndex}.type`) !==
                              "TRUE_FALSE" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const options = form.getValues(
                                    `questions.${questionIndex}.options`
                                  )
                                  if (options.length > 2) {
                                    form.setValue(
                                      `questions.${questionIndex}.options`,
                                      options.filter(
                                        (_, idx) => idx !== optionIndex
                                      )
                                    )
                                  }
                                }}
                                disabled={
                                  form.watch(
                                    `questions.${questionIndex}.options`
                                  )?.length <= 2
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}

                      {form.watch(`questions.${questionIndex}.type`) !==
                        "TRUE_FALSE" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const options = form.getValues(
                              `questions.${questionIndex}.options`
                            )
                            form.setValue(
                              `questions.${questionIndex}.options`,
                              [
                                ...options,
                                {
                                  id: uuidv4(),
                                  text: "",
                                  textAr: "",
                                  isCorrect: false,
                                },
                              ]
                            )
                          }}
                        >
                          <Plus className="me-2 h-4 w-4" />
                          {t("addOption")}
                        </Button>
                      )}
                    </div>

                    {/* Explanation */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`questions.${questionIndex}.explanation`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("explanation")} (EN)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Explain the correct answer..."
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`questions.${questionIndex}.explanationAr`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("explanation")} (AR)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="شرح الإجابة الصحيحة..."
                                dir="rtl"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Points */}
                    <FormField
                      control={form.control}
                      name={`questions.${questionIndex}.points`}
                      render={({ field }) => (
                        <FormItem className="max-w-[200px]">
                          <FormLabel>{t("points")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Delete Question */}
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(questionIndex)}
                      >
                        <Trash2 className="me-2 h-4 w-4" />
                        {t("deleteQuestion")}
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="me-2 h-4 w-4" />
            )}
            {t("saveQuiz")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
