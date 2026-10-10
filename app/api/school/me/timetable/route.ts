import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireUser, run } from "../../_shared"

/**
 * GET /api/school/me/timetable?as=teacher
 * Students: periods of the classes they belong to. Teachers (as=teacher):
 * periods they teach in any school.
 */
export async function GET(request: Request) {
  return run("My timetable", async () => {
    const session = await requireUser()
    const asTeacher = new URL(request.url).searchParams.get("as") === "teacher"
    const where = asTeacher
      ? { teacherId: session.user.id }
      : { group: { members: { some: { studentId: session.user.id } } } }
    const entries = await db.timetableEntry.findMany({
      where,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: {
        group: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, image: true } },
        organization: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(entries)
  })
}
