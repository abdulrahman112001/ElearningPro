import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"

// GET /api/admin/conversations/:userA/:userB: full thread between two users (read-only)
export async function GET(
  request: Request,
  { params }: { params: { userA: string; userB: string } }
) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const { userA, userB } = params

    const [users, messages] = await Promise.all([
      db.user.findMany({
        where: { id: { in: [userA, userB] } },
        select: { id: true, name: true, email: true, image: true, role: true },
      }),
      db.message.findMany({
        where: {
          OR: [
            { fromUserId: userA, toUserId: userB },
            { fromUserId: userB, toUserId: userA },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 1000,
        select: { id: true, content: true, fromUserId: true, toUserId: true, isRead: true, createdAt: true },
      }),
    ])
    if (users.length < 2) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json({ participants: users, messages })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get conversation error:", error)
    return NextResponse.json({ error: "Failed to get conversation" }, { status: 500 })
  }
}
