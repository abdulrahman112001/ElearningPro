import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { orgManagerIds, serverError } from "../../_lib"

type Params = { params: { orgId: string } }

const DAY_MS = 24 * 60 * 60 * 1000

// POST /api/organizations/[orgId]/join-requests { message? }
// A student asks to join; managers get a notification with a link to add them.
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only student accounts can ask to join", code: "students_only" }, { status: 403 })
    }
    const org = await db.organization.findUnique({
      where: { id: params.orgId },
      select: { id: true, name: true, isApproved: true, isActive: true },
    })
    if (!org || !org.isApproved || !org.isActive) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }
    const existing = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: session.user.id } },
    })
    if (existing) return NextResponse.json({ error: "You are already a member", code: "already_member" }, { status: 409 })

    const body = await readJson(request)
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : ""

    const perOrg = rateLimit({ scope: `org-join:${org.id}`, identifier: session.user.id, limit: 1, windowMs: DAY_MS })
    if (!perOrg.success) return tooManyRequests(perOrg.resetAt)
    const overall = rateLimit({ scope: "org-join", identifier: session.user.id, limit: 10, windowMs: DAY_MS })
    if (!overall.success) return tooManyRequests(overall.resetAt)

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true },
    })
    const managers = await orgManagerIds(org.id)
    const who = `${user?.name ?? "A student"} <${user?.email}>${user?.phone ? ` (${user.phone})` : ""}`
    if (managers.length) {
      await db.notification.createMany({
        data: managers.map((id) => ({
          userId: id,
          type: "SYSTEM" as const,
          title: `Join request for ${org.name}`,
          message: `${who} wants to join ${org.name}.${message ? ` "${message}"` : ""}`,
          link: `/org/${org.id}/members?add=${encodeURIComponent(user?.email ?? "")}`,
        })),
      })
    }
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "organization.join_requested",
      entityType: "organization",
      entityId: org.id,
      summary: `${user?.name ?? user?.email} asked to join "${org.name}"`,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Org join request error:", error, "Failed to send join request")
  }
}
