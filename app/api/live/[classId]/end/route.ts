import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deleteRoom } from "@/lib/livekit"

// End live class (instructor only)
export async function POST(
  request: Request,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const liveClass = await db.liveClass.findUnique({
      where: {
        id: params.classId,
        instructorId: session.user.id,
      },
    })

    if (!liveClass) {
      return NextResponse.json(
        { error: "Live class not found" },
        { status: 404 }
      )
    }

    if (liveClass.status !== "LIVE") {
      return NextResponse.json({ error: "Class is not live" }, { status: 400 })
    }

    // Delete LiveKit room
    try {
      await deleteRoom(liveClass.roomName)
    } catch (e) {
      console.error("Failed to delete room:", e)
    }

    // Calculate actual duration
    const actualDuration = liveClass.startedAt
      ? Math.floor((Date.now() - liveClass.startedAt.getTime()) / 60000) // minutes
      : 0

    // Update status to ENDED
    await db.liveClass.update({
      where: { id: params.classId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        actualDuration,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("End live class error:", error)
    return NextResponse.json(
      { error: "Failed to end live class" },
      { status: 500 }
    )
  }
}
