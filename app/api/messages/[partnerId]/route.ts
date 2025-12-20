import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

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
    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      )
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

    return NextResponse.json(message)
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}
