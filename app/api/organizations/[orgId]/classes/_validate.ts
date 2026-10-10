import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"
import { CLASS_MODES } from "../../_lib"

/** The organization's class with this id, or null. */
export async function loadOrgClass(orgId: string, groupId: string) {
  return db.classGroup.findFirst({ where: { id: groupId, organizationId: orgId } })
}

export interface ClassInput {
  name?: string
  description?: string | null
  gradeLevelId?: string | null
  instructorId?: string
  mode?: string
  location?: string | null
  monthlyFee?: number
  capacity?: number | null
}

/** Validates class fields; `partial` = update. Checks the teacher belongs to the org. */
export async function parseClassInput(
  orgId: string,
  body: Record<string, any>,
  partial: boolean
): Promise<ClassInput> {
  const out: ClassInput = {}
  if (body.name !== undefined || !partial) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      throw new ApiError(400, "Class name is required (max 100 characters)")
    }
    out.name = body.name.trim()
  }
  if (body.description !== undefined) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 2000)) {
      throw new ApiError(400, "description must be text (max 2000)")
    }
    out.description = body.description?.trim() || null
  }
  if (body.gradeLevelId !== undefined) {
    if (body.gradeLevelId) {
      if (typeof body.gradeLevelId !== "string") throw new ApiError(400, "Invalid grade level")
      const g = await db.gradeLevel.findUnique({ where: { id: body.gradeLevelId }, select: { id: true } })
      if (!g) throw new ApiError(404, "Grade level not found")
    }
    out.gradeLevelId = body.gradeLevelId || null
  }
  if (body.instructorId !== undefined || !partial) {
    if (typeof body.instructorId !== "string" || !body.instructorId) {
      throw new ApiError(400, "A teacher must be assigned", { code: "teacher_required" })
    }
    const m = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: body.instructorId } },
      select: {
        role: true,
        user: { select: { role: true, isBlocked: true, instructorProfile: { select: { isApproved: true } } } },
      },
    })
    const ok =
      !!m &&
      ["OWNER", "MANAGER", "TEACHER"].includes(m.role) &&
      m.user.role === "INSTRUCTOR" &&
      m.user.instructorProfile?.isApproved === true &&
      !m.user.isBlocked
    if (!ok) {
      throw new ApiError(400, "The teacher must be an approved instructor who is a teacher or manager here", {
        code: "invalid_teacher",
      })
    }
    out.instructorId = body.instructorId
  }
  if (body.mode !== undefined) {
    if (!CLASS_MODES.includes(body.mode)) throw new ApiError(400, "mode must be ONLINE, OFFLINE or HYBRID")
    out.mode = body.mode
  }
  if (body.location !== undefined) {
    if (body.location !== null && (typeof body.location !== "string" || body.location.length > 200)) {
      throw new ApiError(400, "location must be text (max 200)")
    }
    out.location = body.location?.trim() || null
  }
  if (body.monthlyFee !== undefined) {
    const fee = Number(body.monthlyFee)
    if (body.monthlyFee === null || body.monthlyFee === "" || !Number.isFinite(fee) || fee < 0 || fee > 1_000_000) {
      throw new ApiError(400, "monthlyFee must be a number >= 0")
    }
    out.monthlyFee = Math.round(fee * 100) / 100
  }
  if (body.capacity !== undefined) {
    if (body.capacity === null || body.capacity === "") out.capacity = null
    else {
      const cap = Number(body.capacity)
      if (!Number.isInteger(cap) || cap < 1 || cap > 10_000) throw new ApiError(400, "capacity must be a whole number >= 1")
      out.capacity = cap
    }
  }
  return out
}
