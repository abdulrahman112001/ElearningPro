import { NextResponse } from "next/server"
import { announcementsForStudent } from "@/lib/school"
import { requireUser, run } from "../../_shared"

// GET /api/school/me/announcements : announcements of the student's schools and classes (audience ALL / STUDENTS)
export async function GET() {
  return run("My announcements", async () => {
    const session = await requireUser()
    return NextResponse.json(await announcementsForStudent(session.user.id))
  })
}
