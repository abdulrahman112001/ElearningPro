import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"

export async function PATCH(
  request: Request,
  { params }: { params: { notificationId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await readJson(request)

    const notification = await db.notification.update({
      where: { id: params.notificationId },
      data: {
        ...(typeof body.isRead === "boolean" && {
          isRead: body.isRead,
          readAt: body.isRead ? new Date() : null,
        }),
        ...(body.title && { title: body.title }),
        ...(body.message && { message: body.message }),
        ...(body.link !== undefined && { link: body.link }),
      },
    })

    return NextResponse.json(notification)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update notification error:", error)
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { notificationId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.notification.delete({ where: { id: params.notificationId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete notification error:", error)
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    )
  }
}
