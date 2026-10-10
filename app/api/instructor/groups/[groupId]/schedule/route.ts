import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { parseSlot, requireGroupManager } from "@/lib/attendance"

type Params = { params: { groupId: string } }

// GET /api/instructor/groups/:id/schedule: weekly slots
export async function GET(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const slots = await db.groupScheduleSlot.findMany({
      where: { groupId: params.groupId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    })
    return NextResponse.json({ slots })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("List schedule slots error:", error)
    return NextResponse.json({ error: "Failed to load the schedule" }, { status: 500 })
  }
}

// POST /api/instructor/groups/:id/schedule { dayOfWeek, startTime, durationMin?, location? }
export async function POST(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const parsed = parseSlot(await readJson(request))
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const count = await db.groupScheduleSlot.count({ where: { groupId: params.groupId } })
    if (count >= 30) return NextResponse.json({ error: "Too many slots" }, { status: 400 })
    const duplicate = await db.groupScheduleSlot.findFirst({
      where: { groupId: params.groupId, dayOfWeek: parsed.data.dayOfWeek, startTime: parsed.data.startTime },
    })
    if (duplicate) return NextResponse.json({ error: "A slot already exists at this time", code: "duplicate_slot" }, { status: 409 })
    const slot = await db.groupScheduleSlot.create({
      data: {
        groupId: params.groupId,
        dayOfWeek: parsed.data.dayOfWeek!,
        startTime: parsed.data.startTime!,
        durationMin: parsed.data.durationMin ?? 60,
        location: parsed.data.location ?? null,
      },
    })
    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create schedule slot error:", error)
    return NextResponse.json({ error: "Failed to add the slot" }, { status: 500 })
  }
}
