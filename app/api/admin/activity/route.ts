import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"

/**
 * GET /api/admin/activity?action=&actorId=&role=&q=&from=&to=&page=&limit=
 * Platform-wide audit feed for admins. `action` may be a prefix ("course.").
 */
export async function GET(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const sp = new URL(request.url).searchParams
    const page = Math.max(1, parseInt(sp.get("page") || "1") || 1)
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "30") || 30))
    const action = sp.get("action")
    const actorId = sp.get("actorId")
    const role = sp.get("role")
    const q = sp.get("q")
    const from = sp.get("from")
    const to = sp.get("to")

    if (role && !["ADMIN", "INSTRUCTOR", "STUDENT"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null
    if ((fromDate && isNaN(fromDate.getTime())) || (toDate && isNaN(toDate.getTime()))) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }

    const where = {
      ...(action && (action.endsWith(".") ? { action: { startsWith: action } } : { action })),
      ...(actorId && { actorId }),
      ...(role && { actorRole: role as "ADMIN" | "INSTRUCTOR" | "STUDENT" }),
      ...(q && { summary: { contains: q, mode: "insensitive" as const } }),
      ...((fromDate || toDate) && {
        createdAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) },
      }),
    }

    const [items, total, last24h] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, name: true, email: true, image: true, role: true } } },
      }),
      db.activityLog.count({ where }),
      db.activityLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ])

    return NextResponse.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: { last24h },
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get activity error:", error)
    return NextResponse.json({ error: "Failed to get activity" }, { status: 500 })
  }
}
