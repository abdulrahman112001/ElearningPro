import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"

const STAGES = ["primary", "preparatory", "secondary", "university", "other"]

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { session }
}

// GET /api/admin/grade-levels — all grades incl. inactive, with usage counts
export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const grades = await db.gradeLevel.findMany({
      orderBy: [{ position: "asc" }, { nameEn: "asc" }],
      include: { _count: { select: { courses: true, students: true, classGroups: true } } },
    })
    return NextResponse.json(grades)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin get grades error:", error)
    return NextResponse.json({ error: "Failed to get grade levels" }, { status: 500 })
  }
}

// POST /api/admin/grade-levels { nameAr, nameEn, stage?, position? }
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAdmin()
    if (error) return error
    const { nameAr, nameEn, stage, position } = await readJson(request)
    if (typeof nameAr !== "string" || !nameAr.trim() || typeof nameEn !== "string" || !nameEn.trim()) {
      return NextResponse.json({ error: "nameAr and nameEn are required" }, { status: 400 })
    }
    if (stage !== undefined && stage !== null && !STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
    }
    if (position !== undefined && !Number.isInteger(position)) {
      return NextResponse.json({ error: "position must be an integer" }, { status: 400 })
    }
    const grade = await db.gradeLevel.create({
      data: { nameAr: nameAr.trim(), nameEn: nameEn.trim(), stage: stage ?? null, position: position ?? 0 },
    })
    await logActivity({
      actorId: session!.user.id,
      actorRole: session!.user.role,
      action: "grade.created",
      entityType: "gradeLevel",
      entityId: grade.id,
      summary: `Created grade "${grade.nameEn}"`,
    })
    return NextResponse.json(grade, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin create grade error:", error)
    return NextResponse.json({ error: "Failed to create grade level" }, { status: 500 })
  }
}
