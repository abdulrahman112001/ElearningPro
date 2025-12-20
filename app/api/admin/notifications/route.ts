import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

type Target = "ALL" | "STUDENTS" | "INSTRUCTORS" | "USER"

const NOTIFICATION_TYPES = new Set([
  "SYSTEM",
  "COURSE_PUBLISHED",
  "NEW_ENROLLMENT",
  "NEW_REVIEW",
  "PAYMENT_RECEIVED",
  "CERTIFICATE_ISSUED",
  "LIVE_SESSION_STARTING",
  "MESSAGE_RECEIVED",
])

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const target: Target = body.target || "ALL"

    const { title, message, type, email, link } = body

    if (!title || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    if (type && !NOTIFICATION_TYPES.has(type)) {
      return NextResponse.json(
        { error: "Invalid notification type" },
        { status: 400 }
      )
    }

    let userIds: string[] = []

    switch (target) {
      case "ALL": {
        const users = await db.user.findMany({ select: { id: true } })
        userIds = users.map((u) => u.id)
        break
      }
      case "STUDENTS": {
        const students = await db.user.findMany({
          where: { role: "STUDENT" },
          select: { id: true },
        })
        userIds = students.map((u) => u.id)
        break
      }
      case "INSTRUCTORS": {
        const instructors = await db.user.findMany({
          where: { role: "INSTRUCTOR" },
          select: { id: true },
        })
        userIds = instructors.map((u) => u.id)
        break
      }
      case "USER": {
        if (!email) {
          return NextResponse.json(
            { error: "Email is required for single user notifications" },
            { status: 400 }
          )
        }
        const user = await db.user.findUnique({ where: { email } })
        if (!user) {
          return NextResponse.json({ error: "User not found" }, { status: 404 })
        }
        userIds = [user.id]
        break
      }
      default:
        return NextResponse.json({ error: "Invalid target" }, { status: 400 })
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "No recipients found" },
        { status: 400 }
      )
    }

    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title,
        message,
        type: type || "SYSTEM",
        link: link || null,
      })),
    })

    return NextResponse.json({ sent: userIds.length }, { status: 201 })
  } catch (error) {
    console.error("Send notification error:", error)
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    )
  }
}
