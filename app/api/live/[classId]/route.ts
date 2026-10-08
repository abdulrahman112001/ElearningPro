import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createRoom, generateToken, deleteRoom } from "@/lib/livekit"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// Get live class details
export async function GET(
  request: Request,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const liveClass = await db.liveClass.findUnique({
      where: { id: params.classId },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        course: {
          select: {
            id: true,
            titleEn: true,
            titleAr: true,
            slug: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
    })

    if (!liveClass) {
      return NextResponse.json(
        { error: "Live class not found" },
        { status: 404 }
      )
    }

    // Course-bound classes are visible to the host, admins and enrolled
    // students only. Answer 404 so the class's existence is not revealed.
    const isHost = liveClass.instructorId === session.user.id
    if (liveClass.courseId && !isHost && session.user.role !== "ADMIN") {
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: { userId: session.user.id, courseId: liveClass.courseId },
        },
      })
      if (!enrollment) {
        return NextResponse.json(
          { error: "Live class not found" },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(liveClass)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get live class error:", error)
    return NextResponse.json(
      { error: "Failed to get live class" },
      { status: 500 }
    )
  }
}

// Update live class
export async function PATCH(
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

    const body = await readJson(request)
    const {
      title,
      titleAr,
      description,
      descriptionAr,
      scheduledAt,
      duration,
    } = body

    const updatedClass = await db.liveClass.update({
      where: { id: params.classId },
      data: {
        title,
        titleAr,
        description,
        descriptionAr,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        duration,
      },
    })

    return NextResponse.json(updatedClass)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update live class error:", error)
    return NextResponse.json(
      { error: "Failed to update live class" },
      { status: 500 }
    )
  }
}

// Delete live class
export async function DELETE(
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

    // Delete room if exists
    if (liveClass.roomName) {
      try {
        await deleteRoom(liveClass.roomName)
      } catch (e) {
    const handled = apiErrorResponse(e)
    if (handled) return handled
        // Room might not exist
      }
    }

    await db.liveClass.delete({
      where: { id: params.classId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete live class error:", error)
    return NextResponse.json(
      { error: "Failed to delete live class" },
      { status: 500 }
    )
  }
}
