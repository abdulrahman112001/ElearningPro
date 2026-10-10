import { NextResponse } from "next/server"
import { studentGrades } from "@/lib/school"
import { requireUser, run } from "../../_shared"

/**
 * GET /api/school/me/grades
 * The student's gradebook marks grouped by term and subject (with weighted
 * averages) plus their graded homework.
 */
export async function GET() {
  return run("My grades", async () => {
    const session = await requireUser()
    return NextResponse.json(await studentGrades(session.user.id))
  })
}
