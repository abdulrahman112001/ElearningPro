import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createRoom, generateToken } from "@/lib/livekit"

// Start live class (instructor only)
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

    if (liveClass.status === "LIVE") {
      // Already live, just return token
      const token = generateToken(
        liveClass.roomName,
        session.user.name || "Instructor",
        session.user.id,
        true // isHost
      )

      return NextResponse.json({
        token,
        roomName: liveClass.roomName,
        wsUrl: process.env.LIVEKIT_URL,
      })
    }

    // Create LiveKit room
    await createRoom(liveClass.roomName)

    // Update status to LIVE
    await db.liveClass.update({
      where: { id: params.classId },
      data: {
        status: "LIVE",
        startedAt: new Date(),
      },
    })

    // Generate token for instructor (host)
    const token = generateToken(
      liveClass.roomName,
      session.user.name || "Instructor",
      session.user.id,
      true // isHost
    )

    return NextResponse.json({
      token,
      roomName: liveClass.roomName,
      wsUrl: process.env.LIVEKIT_URL,
    })
  } catch (error) {
    console.error("Start live class error:", error)
    return NextResponse.json(
      { error: "Failed to start live class" },
      { status: 500 }
    )
  }
}
