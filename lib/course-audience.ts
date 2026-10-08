import { db } from "@/lib/db"
import { ApiError } from "@/lib/api-error"

/**
 * Validates the optional audience of a course: an academic grade and/or one
 * of the instructor's own class groups. Returns the Prisma fields to write.
 * `undefined` leaves a field untouched; `null`/"" clears it.
 */
export async function resolveCourseAudience(
  instructorId: string,
  input: { gradeLevelId?: unknown; classGroupId?: unknown }
): Promise<{ gradeLevelId?: string | null; classGroupId?: string | null }> {
  const out: { gradeLevelId?: string | null; classGroupId?: string | null } = {}

  if (input.gradeLevelId !== undefined) {
    if (input.gradeLevelId === null || input.gradeLevelId === "") {
      out.gradeLevelId = null
    } else {
      if (typeof input.gradeLevelId !== "string") throw new ApiError(400, "Invalid grade level")
      const grade = await db.gradeLevel.findFirst({ where: { id: input.gradeLevelId, isActive: true }, select: { id: true } })
      if (!grade) throw new ApiError(404, "Grade level not found")
      out.gradeLevelId = grade.id
    }
  }

  if (input.classGroupId !== undefined) {
    if (input.classGroupId === null || input.classGroupId === "") {
      out.classGroupId = null
    } else {
      if (typeof input.classGroupId !== "string") throw new ApiError(400, "Invalid group")
      // Only the instructor's own groups: a course cannot be locked to someone else's group.
      const group = await db.classGroup.findFirst({
        where: { id: input.classGroupId, instructorId },
        select: { id: true },
      })
      if (!group) throw new ApiError(404, "Group not found")
      out.classGroupId = group.id
    }
  }

  return out
}
