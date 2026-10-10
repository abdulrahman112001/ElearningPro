import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { requireInstructor } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { parseOrgInput, serverError, slugTaken, uniqueSlug } from "./_lib"

// GET /api/organizations: organizations the signed-in user belongs to
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      orderBy: { joinedAt: "desc" },
      select: {
        role: true,
        joinedAt: true,
        organization: {
          select: {
            id: true, name: true, slug: true, type: true, logoUrl: true, primaryColor: true,
            isApproved: true, isActive: true, governorate: true,
            _count: { select: { members: true, classGroups: true } },
          },
        },
      },
    })
    return NextResponse.json(memberships)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("List organizations error:", error, "Failed to load organizations")
  }
}

// POST /api/organizations: an approved instructor (or admin) creates one.
export async function POST(request: Request) {
  try {
    const { session, error } = await requireInstructor()
    if (error) return error
    const limit = rateLimit({ scope: "org-create", identifier: session.user.id, limit: 20, windowMs: 60 * 60 * 1000 })
    if (!limit.success) return tooManyRequests(limit.resetAt)

    const body = await readJson(request)
    const input = parseOrgInput(body, false)
    let slug: string
    if (input.slug) {
      if (await slugTaken(input.slug)) {
        return NextResponse.json({ error: "This address is already taken", code: "slug_taken" }, { status: 409 })
      }
      slug = input.slug
    } else {
      slug = await uniqueSlug(input.name!)
    }

    const org = await db.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { ...input, name: input.name!, slug, ownerId: session.user.id, isApproved: false },
      })
      await tx.organizationMember.create({
        data: { organizationId: created.id, userId: session.user.id, role: "OWNER" },
      })
      return created
    })

    // Let the admins know there is something to review.
    const admins = await db.user.findMany({ where: { role: "ADMIN", isBlocked: false }, select: { id: true } })
    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "SYSTEM" as const,
          title: "New organization awaiting approval",
          message: `${org.name} (${org.type}) was created and is waiting for review.`,
          link: "/admin/organizations",
        })),
      })
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "organization.created",
      entityType: "organization",
      entityId: org.id,
      summary: `Created organization "${org.name}" (${org.type})`,
      metadata: { slug: org.slug, type: org.type },
    })
    return NextResponse.json(org, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    return serverError("Create organization error:", error, "Failed to create organization")
  }
}
