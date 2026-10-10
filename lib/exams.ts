import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma, QuizQuestion } from "@prisma/client"
import { db } from "@/lib/db"
import {
  computeCertificateGrade,
  generateCertificateNumber,
  hasPassedAllQuizzes,
} from "@/lib/certificates"

/** Late submissions within this window after the deadline are still accepted (network latency). */
export const SUBMIT_GRACE_SECONDS = 60

export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTIPLE_SELECT", "ESSAY"] as const
export type ExamQuestionType = (typeof QUESTION_TYPES)[number]

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const optionSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().max(2000),
  textAr: z.string().max(2000).optional().nullable(),
  isCorrect: z.boolean(),
})

const imageUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isHttpUrl(v), { message: "Image URL must start with http:// or https://" })

/** Question content shared by quiz questions and question-bank items. */
export const questionContentSchema = z
  .object({
    question: z.string().trim().max(10000).default(""),
    questionAr: z.string().trim().max(10000).optional().nullable(),
    type: z.enum(QUESTION_TYPES),
    options: z.array(optionSchema).max(20).default([]),
    explanation: z.string().max(10000).optional().nullable(),
    explanationAr: z.string().max(10000).optional().nullable(),
    points: z.number().int().min(1).max(100).default(1),
    imageUrl: imageUrlSchema,
  })
  .superRefine((q, ctx) => {
    if (!q.question && !q.questionAr) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Question text is required", path: ["question"] })
    }
    if (q.type === "ESSAY") return
    const filled = q.options.filter((o) => o.text.trim() || o.textAr?.trim())
    if (filled.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add at least two options", path: ["options"] })
    }
    const correct = filled.filter((o) => o.isCorrect).length
    if (correct === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select the correct answer", path: ["options"] })
    }
    if (q.type !== "MULTIPLE_SELECT" && correct > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Only one option can be correct", path: ["options"] })
    }
    const ids = new Set(q.options.map((o) => o.id))
    if (ids.size !== q.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option ids must be unique", path: ["options"] })
    }
  })
  .transform((q) => ({
    ...q,
    // The English text column is required: fall back to the Arabic text.
    question: q.question || q.questionAr || "",
    questionAr: q.questionAr || null,
    options:
      q.type === "ESSAY"
        ? []
        : q.options
            .filter((o) => o.text.trim() || o.textAr?.trim())
            .map((o) => ({ ...o, text: o.text.trim() || o.textAr?.trim() || "", textAr: o.textAr?.trim() || undefined })),
  }))

export type QuestionContent = z.infer<typeof questionContentSchema>

/** A question as the student sees it: never the answer key nor the explanation. */
export function sanitizeQuestion(q: Pick<QuizQuestion, "id" | "question" | "questionAr" | "type" | "points" | "imageUrl" | "options">) {
  const options = Array.isArray(q.options) ? (q.options as any[]) : []
  return {
    id: q.id,
    question: q.question,
    questionAr: q.questionAr,
    type: q.type,
    points: q.points,
    imageUrl: q.imageUrl,
    options:
      q.type === "ESSAY"
        ? []
        : options.map((opt) => ({ id: String(opt.id), text: opt.text ?? "", textAr: opt.textAr ?? undefined })),
  }
}

export type StudentQuestion = ReturnType<typeof sanitizeQuestion>

/** Cryptographically shuffled copy. */
export function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Questions served in an attempt, in the order they were served. Attempts
 * created before per-attempt question lists existed fall back to the whole quiz.
 */
export function attemptQuestions<T extends { id: string; position: number }>(
  questionIds: string[],
  all: T[]
): T[] {
  if (!questionIds || questionIds.length === 0) return [...all].sort((a, b) => a.position - b.position)
  const byId = new Map(all.map((q) => [q.id, q]))
  return questionIds.map((id) => byId.get(id)).filter((q): q is T => !!q)
}

/**
 * The moment after which answers are no longer accepted (without grace):
 * the earlier of startedAt + time limit and the exam's closing time.
 */
export function attemptDeadline(
  startedAt: Date,
  quiz: { timeLimit: number | null; availableUntil: Date | null }
): Date | null {
  const candidates: number[] = []
  if (quiz.timeLimit) candidates.push(startedAt.getTime() + quiz.timeLimit * 60_000)
  if (quiz.availableUntil) candidates.push(quiz.availableUntil.getTime())
  return candidates.length ? new Date(Math.min(...candidates)) : null
}

/** Grades one objective answer; returns whether it is fully correct. */
export function gradeObjective(question: Pick<QuizQuestion, "type" | "options">, answer: unknown): boolean {
  const options = Array.isArray(question.options) ? (question.options as any[]) : []
  if (question.type === "MULTIPLE_SELECT") {
    const correct = options.filter((o) => o.isCorrect).map((o) => String(o.id)).sort()
    const selected = Array.from(
      new Set((Array.isArray(answer) ? answer : [answer]).filter((x) => typeof x === "string") as string[])
    ).sort()
    return correct.length === selected.length && correct.every((id, i) => id === selected[i])
  }
  const selectedId = Array.isArray(answer) ? answer[0] : answer
  if (typeof selectedId !== "string") return false
  return options.find((o) => String(o.id) === selectedId)?.isCorrect === true
}

/**
 * Recomputes score / passed / needsGrading of a completed attempt from its
 * stored answers (objective points + teacher scores for essays).
 */
export async function recomputeAttempt(attemptId: string, tx: Prisma.TransactionClient = db) {
  const attempt = await tx.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { quiz: { include: { questions: true } }, answers: true },
  })
  const served = attemptQuestions(attempt.questionIds, attempt.quiz.questions)
  let total = 0
  let earned = 0
  let needsGrading = false
  for (const q of served) {
    total += q.points
    const a = attempt.answers.find((x) => x.questionId === q.id)
    if (!a) continue
    if (q.type === "ESSAY") {
      if (a.gradedAt === null) needsGrading = true
      earned += a.manualScore ?? 0
    } else {
      earned += a.points
    }
  }
  const score = total > 0 ? (earned / total) * 100 : 0
  const passed = !needsGrading && score >= attempt.quiz.passingScore
  return tx.quizAttempt.update({
    where: { id: attemptId },
    data: { score, passed, needsGrading },
  })
}

/**
 * After a passed attempt: marks the quiz lesson complete, refreshes the
 * enrollment progress and issues the certificate when the course is done.
 */
export async function onQuizPassed(userId: string, lessonId: string, courseId: string) {
  const now = new Date()
  await db.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { isCompleted: true, completedAt: now },
    create: { userId, lessonId, isCompleted: true, completedAt: now },
  })

  const allLessons = await db.lesson.findMany({
    where: { chapter: { courseId }, isPublished: true },
    select: { id: true },
  })
  if (allLessons.length === 0) return
  const completedLessons = await db.progress.count({
    where: { userId, lessonId: { in: allLessons.map((l) => l.id) }, isCompleted: true },
  })
  const progressPercentage = Math.min(100, (completedLessons / allLessons.length) * 100)

  await db.enrollment.updateMany({
    where: { userId, courseId },
    data: {
      progress: progressPercentage,
      isCompleted: progressPercentage >= 100,
      completedAt: progressPercentage >= 100 ? now : null,
    },
  })

  if (progressPercentage >= 100 && (await hasPassedAllQuizzes(userId, courseId))) {
    const existing = await db.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    })
    if (!existing) {
      await db.certificate.create({
        data: {
          certificateNo: generateCertificateNumber(),
          userId,
          courseId,
          completedAt: now,
          grade: await computeCertificateGrade(userId, courseId),
        },
      })
    }
  }
}

/** Link to the student's result page for an attempt. */
export function attemptResultLink(courseSlug: string, lessonId: string, attemptId: string) {
  return `/courses/${courseSlug}/lessons/${lessonId}/quiz/result?attemptId=${attemptId}`
}

export const DIFFICULTIES = ["easy", "medium", "hard"] as const

/** Question-bank item: question content plus classification. */
export const bankItemSchema = z.intersection(
  questionContentSchema,
  z.object({
    subject: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable()
      .transform((v) => v || null),
    gradeLevelId: z
      .string()
      .max(100)
      .optional()
      .nullable()
      .transform((v) => v || null),
    tags: z
      .array(z.string().trim().max(40))
      .max(20)
      .default([])
      .transform((tags) => Array.from(new Set(tags.filter(Boolean)))),
    difficulty: z.enum(DIFFICULTIES).optional().nullable().transform((v) => v ?? null),
  })
)

export type BankItemInput = z.infer<typeof bankItemSchema>

export function bankItemData(v: BankItemInput) {
  return {
    question: v.question,
    questionAr: v.questionAr,
    type: v.type,
    options: v.options,
    explanation: v.explanation || null,
    explanationAr: v.explanationAr || null,
    imageUrl: v.imageUrl,
    points: v.points,
    subject: v.subject,
    gradeLevelId: v.gradeLevelId,
    tags: v.tags,
    difficulty: v.difficulty,
  }
}

/** 400 response for a zod validation error (first issue + field path). */
export function zodErrorResponse(error: z.ZodError) {
  const issue = error.errors[0]
  return NextResponse.json({ error: issue.message, field: issue.path.join(".") || undefined }, { status: 400 })
}
