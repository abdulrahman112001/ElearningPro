export type ExamQuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTIPLE_SELECT" | "ESSAY"

export const EXAM_QUESTION_TYPES: ExamQuestionType[] = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "MULTIPLE_SELECT",
  "ESSAY",
]

export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export interface EditorOption {
  id: string
  text: string
  textAr?: string
  isCorrect: boolean
}

/** A question as edited in the quiz editor / question bank form. */
export interface EditorQuestion {
  /** Server id for saved quiz questions, `temp-*` for new ones. */
  id: string
  question: string
  questionAr?: string
  type: ExamQuestionType
  options: EditorOption[]
  explanation?: string
  explanationAr?: string
  points: number
  imageUrl?: string
}

let counter = 0
export function tempId(prefix = "temp") {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export function defaultOptions(type: ExamQuestionType): EditorOption[] {
  if (type === "ESSAY") return []
  if (type === "TRUE_FALSE") {
    return [
      { id: tempId("opt"), text: "True", textAr: "صح", isCorrect: true },
      { id: tempId("opt"), text: "False", textAr: "خطأ", isCorrect: false },
    ]
  }
  return [0, 1, 2, 3].map((i) => ({ id: tempId("opt"), text: "", textAr: "", isCorrect: i === 0 }))
}

export function blankQuestion(type: ExamQuestionType = "MULTIPLE_CHOICE"): EditorQuestion {
  return {
    id: tempId(),
    question: "",
    questionAr: "",
    type,
    options: defaultOptions(type),
    explanation: "",
    explanationAr: "",
    points: 1,
    imageUrl: "",
  }
}

/** Options switched to a new question type, keeping what still makes sense. */
export function optionsForType(q: EditorQuestion, type: ExamQuestionType): EditorOption[] {
  if (type === "ESSAY" || type === "TRUE_FALSE") return defaultOptions(type)
  if (q.type === "ESSAY" || q.type === "TRUE_FALSE") return defaultOptions(type)
  if (type === "MULTIPLE_CHOICE") {
    const first = q.options.findIndex((o) => o.isCorrect)
    return q.options.map((o, i) => ({ ...o, isCorrect: i === (first === -1 ? 0 : first) }))
  }
  return q.options
}

export function isHttpUrl(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/** Client-side check mirroring the server rules; returns a translation key or null. */
export function questionProblem(q: EditorQuestion): string | null {
  if (!q.question.trim() && !q.questionAr?.trim()) return "errors.questionRequired"
  if (q.imageUrl?.trim() && !isHttpUrl(q.imageUrl.trim())) return "errors.imageUrlInvalid"
  if (!Number.isInteger(q.points) || q.points < 1 || q.points > 100) return "errors.pointsInvalid"
  if (q.type === "ESSAY") return null
  const filled = q.options.filter((o) => o.text.trim() || o.textAr?.trim())
  if (filled.length < 2) return "errors.twoOptions"
  const correct = filled.filter((o) => o.isCorrect).length
  if (correct === 0) return "errors.correctRequired"
  return null
}

/** Payload shape accepted by the quiz and question-bank APIs. */
export function questionPayload(q: EditorQuestion) {
  return {
    question: q.question.trim(),
    questionAr: q.questionAr?.trim() || null,
    type: q.type,
    options:
      q.type === "ESSAY"
        ? []
        : q.options
            .filter((o) => o.text.trim() || o.textAr?.trim())
            .map((o) => ({ id: o.id, text: o.text.trim(), textAr: o.textAr?.trim() || null, isCorrect: o.isCorrect })),
    explanation: q.explanation?.trim() || null,
    explanationAr: q.explanationAr?.trim() || null,
    points: q.points,
    imageUrl: q.imageUrl?.trim() || null,
  }
}

/** Server record (quiz question, bank item, AI output) -> editor question with a fresh id. */
export function toEditorQuestion(src: {
  id?: string
  question: string
  questionAr?: string | null
  type: string
  options?: unknown
  explanation?: string | null
  explanationAr?: string | null
  points?: number
  imageUrl?: string | null
}, keepId = false): EditorQuestion {
  const type = (["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTIPLE_SELECT", "ESSAY"].includes(src.type)
    ? src.type
    : "MULTIPLE_CHOICE") as ExamQuestionType
  const options = Array.isArray(src.options) ? (src.options as any[]) : []
  return {
    id: keepId && src.id ? src.id : tempId(),
    question: src.question ?? "",
    questionAr: src.questionAr ?? "",
    type,
    options:
      type === "ESSAY"
        ? []
        : options.map((o) => ({
            id: keepId ? String(o.id) : tempId("opt"),
            text: o.text ?? "",
            textAr: o.textAr ?? "",
            isCorrect: !!o.isCorrect,
          })),
    explanation: src.explanation ?? "",
    explanationAr: src.explanationAr ?? "",
    points: src.points && src.points > 0 ? Math.round(src.points) : 1,
    imageUrl: src.imageUrl ?? "",
  }
}
