import { ApiError } from "@/lib/api-error"
import { cleanText, cleanUrl, isFiniteNumber, parseDate } from "@/lib/school"

export type AssignmentFields = {
  title: string
  description: string | null
  subject: string | null
  dueAt: Date | null
  maxScore: number
  allowLate: boolean
  attachmentUrl: string | null
}

/**
 * Validates the editable fields of an assignment. With `partial`, missing
 * fields are left out of the result (PATCH).
 */
export function parseAssignmentFields(body: any, partial: boolean): Partial<AssignmentFields> {
  const out: Partial<AssignmentFields> = {}
  const has = (k: string) => body && Object.prototype.hasOwnProperty.call(body, k)

  if (!partial || has("title")) {
    const title = cleanText(body?.title, 200)
    if (!title) throw new ApiError(400, "Title is required", { field: "title", code: "required" })
    out.title = title
  }
  if (!partial || has("description")) {
    if (body?.description != null && typeof body.description !== "string") {
      throw new ApiError(400, "description must be text", { field: "description" })
    }
    out.description = cleanText(body?.description, 10000)
  }
  if (!partial || has("subject")) out.subject = cleanText(body?.subject, 80)
  if (!partial || has("dueAt")) out.dueAt = parseDate(body?.dueAt, "dueAt")
  if (!partial || has("maxScore")) {
    const max = body?.maxScore ?? (partial ? undefined : 10)
    if (!isFiniteNumber(max) || max <= 0 || max > 1000) {
      throw new ApiError(400, "maxScore must be between 0 and 1000", { field: "maxScore", code: "invalid" })
    }
    out.maxScore = max
  }
  if (!partial || has("allowLate")) {
    const v = body?.allowLate ?? true
    if (typeof v !== "boolean") throw new ApiError(400, "allowLate must be true or false", { field: "allowLate" })
    out.allowLate = v
  }
  if (!partial || has("attachmentUrl")) out.attachmentUrl = cleanUrl(body?.attachmentUrl, "attachmentUrl")
  return out
}

export function idOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}
