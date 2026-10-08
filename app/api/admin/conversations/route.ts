import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"

type Row = {
  user_a: string
  user_b: string
  message_count: number
  last_at: Date
  last_content: string
}

/**
 * GET /api/admin/conversations?q=&page=
 * Every private conversation on the platform (read-only oversight), one row
 * per pair of users, most recent first.
 */
export async function GET(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const sp = new URL(request.url).searchParams
    const page = Math.max(1, parseInt(sp.get("page") || "1") || 1)
    const limit = 30
    const q = sp.get("q")?.trim()

    // Optional filter by participant name/email
    let userFilter: string[] | null = null
    if (q) {
      const users = await db.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true },
        take: 200,
      })
      userFilter = users.map((u) => u.id)
      if (userFilter.length === 0) {
        return NextResponse.json({ conversations: [], pagination: { page, limit, total: 0, pages: 0 } })
      }
    }

    const rows = await db.$queryRaw<Row[]>`
      SELECT LEAST("fromUserId", "toUserId") AS user_a,
             GREATEST("fromUserId", "toUserId") AS user_b,
             COUNT(*)::int AS message_count,
             MAX("createdAt") AS last_at,
             (ARRAY_AGG("content" ORDER BY "createdAt" DESC))[1] AS last_content
      FROM "Message"
      GROUP BY 1, 2
      ORDER BY last_at DESC`

    const filtered = userFilter
      ? rows.filter((r) => userFilter!.includes(r.user_a) || userFilter!.includes(r.user_b))
      : rows
    const pageRows = filtered.slice((page - 1) * limit, page * limit)
    const ids = Array.from(new Set(pageRows.flatMap((r) => [r.user_a, r.user_b])))
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, image: true, role: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))

    return NextResponse.json({
      conversations: pageRows.map((r) => ({
        participants: [byId.get(r.user_a), byId.get(r.user_b)].filter(Boolean),
        messageCount: r.message_count,
        lastMessageAt: r.last_at,
        lastMessage: r.last_content?.slice(0, 160) ?? "",
      })),
      pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get conversations error:", error)
    return NextResponse.json({ error: "Failed to get conversations" }, { status: 500 })
  }
}
