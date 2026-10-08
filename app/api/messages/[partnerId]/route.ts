import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity"
import { NextRequest, NextResponse } from "next/server"
import { readJson, apiErrorResponse } from "@/lib/api-error"

export async function GET(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { partnerId } = params
    const userId = session.user.id

    // Fetch messages between current user and partner
    const messages = await db.message.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: partnerId },
          { fromUserId: partnerId, toUserId: userId },
        ],
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    // Mark messages from partner as read
    await db.message.updateMany({
      where: {
        fromUserId: partnerId,
        toUserId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { partnerId } = params
    const userId = session.user.id
    const { content } = await readJson(request)

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      )
    }

    if (partnerId === userId) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 })
    }

    const partner = await db.user.findUnique({
      where: { id: partnerId },
      select: { id: true, role: true },
    })
    if (!partner) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Messaging is for teaching relationships: student <-> instructor of a
    // course the student is enrolled in, an existing conversation, or admins.
    if (session.user.role !== "ADMIN" && partner.role !== "ADMIN") {
      const [linked, existingConversation] = await Promise.all([
        db.enrollment.findFirst({
          where: {
            OR: [
              { userId, course: { instructorId: partnerId } },
              { userId: partnerId, course: { instructorId: userId } },
            ],
          },
          select: { id: true },
        }),
        db.message.findFirst({
          where: { fromUserId: partnerId, toUserId: userId },
          select: { id: true },
        }),
      ])
      if (!linked && !existingConversation) {
        return NextResponse.json(
          { error: "You can only message your instructors or students" },
          { status: 403 }
        )
      }
    }

    // Create message
    const message = await db.message.create({
      data: {
        content: content.trim(),
        fromUserId: userId,
        toUserId: partnerId,
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    await logActivity({
      actorId: userId,
      actorRole: session.user.role,
      action: "message.sent",
      entityType: "user",
      entityId: partnerId,
      summary: content.trim().slice(0, 200),
    })

    return NextResponse.json(message)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Error sending message:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}
