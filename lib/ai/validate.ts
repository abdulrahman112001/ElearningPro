/**
 * Pure validation helpers for the AI features. No database or SDK imports so
 * they can be unit-tested directly.
 */

export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTIPLE_SELECT", "ESSAY"] as const
export type AiQuestionType = (typeof QUESTION_TYPES)[number]
export const DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]
export const QUESTION_LANGUAGES = ["ar", "en", "both"] as const
export type QuestionLanguage = (typeof QUESTION_LANGUAGES)[number]

export const MAX_TUTOR_MESSAGE = 2000
export const MAX_TRANSCRIPT = 50_000
export const DEFAULT_DAILY_LIMIT = 30
export const DAILY_LIMIT_KEY = "ai.dailyLimit"

/** Same shape as `GeneratedQuestion` in components/ai/generate-questions-dialog.tsx. */
export type ValidQuestion = {
  type: AiQuestionType
  question: string
  questionAr?: string
  options: { id: string; text: string; textAr?: string; isCorrect: boolean }[]
  explanation?: string
  explanationAr?: string
  points: number
}

export type GenerateRequest = {
  lessonId?: string
  courseId?: string
  count: number
  types: AiQuestionType[]
  difficulty: Difficulty
  language: QuestionLanguage
}

export type FieldError = { field: string; code: string }

/** Validates the body of POST /api/ai/generate-questions. */
export function parseGenerateRequest(body: unknown): { ok: true; value: GenerateRequest } | { ok: false; errors: FieldError[] } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const errors: FieldError[] = []
  const lessonId = b.lessonId
  const courseId = b.courseId
  const hasLesson = typeof lessonId === "string" && lessonId.trim().length > 0
  const hasCourse = typeof courseId === "string" && courseId.trim().length > 0
  if (lessonId !== undefined && lessonId !== null && !hasLesson) errors.push({ field: "lessonId", code: "invalid" })
  if (courseId !== undefined && courseId !== null && !hasCourse) errors.push({ field: "courseId", code: "invalid" })
  if (!hasLesson && !hasCourse && !errors.length) errors.push({ field: "lessonId", code: "required" })

  const count = b.count === undefined ? 5 : b.count
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 20) {
    errors.push({ field: "count", code: "out_of_range" })
  }

  let types: AiQuestionType[] = ["MULTIPLE_CHOICE"]
  if (b.types !== undefined) {
    if (
      !Array.isArray(b.types) ||
      b.types.length === 0 ||
      !b.types.every((t) => typeof t === "string" && (QUESTION_TYPES as readonly string[]).includes(t))
    ) {
      errors.push({ field: "types", code: "invalid" })
    } else {
      types = Array.from(new Set(b.types as AiQuestionType[]))
    }
  }

  const difficulty = b.difficulty === undefined ? "medium" : b.difficulty
  if (typeof difficulty !== "string" || !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    errors.push({ field: "difficulty", code: "invalid" })
  }
  const language = b.language === undefined ? "ar" : b.language
  if (typeof language !== "string" || !(QUESTION_LANGUAGES as readonly string[]).includes(language)) {
    errors.push({ field: "language", code: "invalid" })
  }

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      lessonId: hasLesson ? (lessonId as string) : undefined,
      courseId: hasLesson ? undefined : (courseId as string),
      count: count as number,
      types,
      difficulty: difficulty as Difficulty,
      language: language as QuestionLanguage,
    },
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const opt = (v: unknown) => str(v) || undefined

/**
 * Strictly validates questions coming back from the model. Invalid questions
 * are dropped (with a reason) rather than "repaired", so a teacher never sees
 * a question whose answer key is wrong.
 */
export function validateGeneratedQuestions(
  raw: unknown,
  opts: { types: AiQuestionType[]; language: QuestionLanguage; max: number }
): { questions: ValidQuestion[]; rejected: { index: number; reason: string }[] } {
  const list = Array.isArray(raw) ? raw : []
  const questions: ValidQuestion[] = []
  const rejected: { index: number; reason: string }[] = []

  list.forEach((item, index) => {
    const reject = (reason: string) => rejected.push({ index, reason })
    if (!item || typeof item !== "object") return reject("not_an_object")
    const q = item as Record<string, unknown>
    const type = q.type as AiQuestionType
    if (!opts.types.includes(type)) return reject("type_not_requested")

    let question = str(q.question)
    let questionAr = opt(q.questionAr)
    let explanation = opt(q.explanation)
    let explanationAr = opt(q.explanationAr)
    // Arabic-only sets keep the Arabic text in both fields so the question
    // bank (which requires `question`) always has a value.
    if (opts.language === "ar") {
      question = questionAr || question
      questionAr = question || undefined
      explanation = explanationAr || explanation
      explanationAr = explanation
    }
    if (opts.language === "en") {
      questionAr = undefined
      explanationAr = undefined
    }
    if (!question || question.length > 2000) return reject("empty_question")
    if (opts.language === "both" && !questionAr) return reject("missing_arabic")

    const rawOptions = Array.isArray(q.options) ? q.options : null
    if (!rawOptions) return reject("options_not_array")
    const options: ValidQuestion["options"] = []
    const ids = new Set<string>()
    for (const o of rawOptions) {
      if (!o || typeof o !== "object") return reject("bad_option")
      const r = o as Record<string, unknown>
      const id = str(r.id)
      let text = str(r.text)
      let textAr = opt(r.textAr)
      if (opts.language === "ar") {
        text = textAr || text
        textAr = text || undefined
      }
      if (opts.language === "en") textAr = undefined
      if (!id || ids.has(id)) return reject("duplicate_option_id")
      if (!text) return reject("empty_option")
      if (typeof r.isCorrect !== "boolean") return reject("bad_option")
      ids.add(id)
      options.push({ id, text, ...(textAr && { textAr }), isCorrect: r.isCorrect })
    }
    const correct = options.filter((o) => o.isCorrect).length

    switch (type) {
      case "MULTIPLE_CHOICE":
        if (options.length < 2 || options.length > 6) return reject("option_count")
        if (correct !== 1) return reject("correct_count")
        break
      case "TRUE_FALSE":
        if (options.length !== 2) return reject("option_count")
        if (correct !== 1) return reject("correct_count")
        break
      case "MULTIPLE_SELECT":
        if (options.length < 2 || options.length > 8) return reject("option_count")
        if (correct < 1) return reject("correct_count")
        break
      case "ESSAY":
        if (options.length !== 0) return reject("essay_has_options")
        break
    }

    const pointsRaw = typeof q.points === "number" ? Math.round(q.points) : 1
    const points = Math.min(100, Math.max(1, pointsRaw || 1))

    if (questions.length >= opts.max) return reject("over_count")
    questions.push({
      type,
      question,
      ...(questionAr && { questionAr }),
      options,
      ...(explanation && { explanation }),
      ...(explanationAr && { explanationAr }),
      points,
    })
  })

  return { questions, rejected }
}

/** Reads the `ai.dailyLimit` setting value; falls back to the default for anything invalid. */
export function parseDailyLimit(value: string | null | undefined): number {
  if (value == null || value.trim() === "") return DEFAULT_DAILY_LIMIT
  const n = Number(value.trim().replace(/^"(.*)"$/, "$1"))
  if (!Number.isInteger(n) || n < 0) return DEFAULT_DAILY_LIMIT
  return n
}

/** 0 means "no AI requests allowed". */
export function evaluateDailyLimit(used: number, limit: number) {
  return { used, limit, remaining: Math.max(0, limit - used), exceeded: used >= limit }
}

/** Start of the current day in Cairo time, as a UTC Date. */
export function startOfDay(now = new Date(), timeZone = "Africa/Cairo"): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  const offset = asUtc - Math.floor(now.getTime() / 1000) * 1000
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")) - offset)
}

/** Removes HTML tags/entities from rich-text descriptions before sending them to the model. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
}
