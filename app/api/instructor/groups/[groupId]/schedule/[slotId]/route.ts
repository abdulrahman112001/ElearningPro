import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { parseSlot, requireGroupManager } from "@/lib/attendance"

type Params = { params: { groupId: string; slotId: string } }

// PATCH /api/instructor/groups/:id/schedule/:slotId
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const slot = await db.groupScheduleSlot.findFirst({ where: { id: params.slotId, groupId: params.groupId } })
    if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 })
    const parsed = parseSlot(await readJson(request), true)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const updated = await db.groupScheduleSlot.update({ where: { id: slot.id }, data: parsed.data })
    return NextResponse.json(updated)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update schedule slot error:", error)
    return NextResponse.json({ error: "Failed to update the slot" }, { status: 500 })
  }
}

// DELETE /api/instructor/groups/:id/schedule/:slotId (generated sessions stay)
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const { count } = await db.groupScheduleSlot.deleteMany({ where: { id: params.slotId, groupId: params.groupId } })
    if (count === 0) return NextResponse.json({ error: "Slot not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete schedule slot error:", error)
    return NextResponse.json({ error: "Failed to delete the slot" }, { status: 500 })
  }
}
