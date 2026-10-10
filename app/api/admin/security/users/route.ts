import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"

export const dynamic = "force-dynamic"

/** Finds users by name, email or phone with their active device count. */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error

    const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100)
    if (q.length < 2) return NextResponse.json({ users: [] })

    const users = await db.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        _count: { select: { devices: { where: { revokedAt: null } } } },
      },
    })

    return NextResponse.json({
      users: users.map(({ _count, ...u }) => ({ ...u, activeDevices: _count.devices })),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Security user search error:", error)
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 })
  }
}
