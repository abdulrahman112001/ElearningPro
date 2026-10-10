import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import { requireAdmin } from "@/lib/instructor-guard"

// GET /api/admin/organizations?status=pending|approved|suspended&q=
export async function GET(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const url = new URL(request.url)
    const status = url.searchParams.get("status")
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
    const where: Record<string, unknown> = {}
    if (status === "pending") where.isApproved = false
    if (status === "approved") Object.assign(where, { isApproved: true, isActive: true })
    if (status === "suspended") where.isActive = false
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { owner: { email: { contains: q, mode: "insensitive" } } },
      ]
    }
    const orgs = await db.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, classGroups: true, courses: true } },
      },
    })
    return NextResponse.json(orgs)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin list organizations error:", error)
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 })
  }
}
