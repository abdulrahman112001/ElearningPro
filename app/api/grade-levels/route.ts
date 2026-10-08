import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"

// GET /api/grade-levels — public list of active grades, in display order
export async function GET() {
  try {
    const grades = await db.gradeLevel.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { nameEn: "asc" }],
      select: { id: true, nameAr: true, nameEn: true, stage: true, position: true },
    })
    return NextResponse.json(grades)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get grade levels error:", error)
    return NextResponse.json({ error: "Failed to get grade levels" }, { status: 500 })
  }
}
