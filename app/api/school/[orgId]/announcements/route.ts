import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ApiError, readJson } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import {
  announcementRecipients,
  AUDIENCES,
  cleanText,
  groupTeachingAccess,
  requireOrgGroup,
  requireSchoolAccess,
  type Audience,
} from "@/lib/school"
import { requireUser, run } from "../../_shared"

type Params = { params: { orgId: string } }

const include = {
  author: { select: { id: true, name: true, image: true } },
  group: { select: { id: true, name: true } },
} as const

// GET /api/school/:orgId/announcements?groupId=&audience=
export async function GET(request: Request, { params }: Params) {
  return run("School announcements", async () => {
    const session = await requireUser()
    await requireSchoolAccess(params.orgId, session.user, false)
    const url = new URL(request.url)
    const groupId = url.searchParams.get("groupId")
    const audience = url.searchParams.get("audience")
    const rows = await db.announcement.findMany({
      where: {
        organizationId: params.orgId,
        ...(groupId === "org" ? { groupId: null } : groupId ? { groupId } : {}),
        ...(audience && (AUDIENCES as readonly string[]).includes(audience) ? { audience } : {}),
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 200,
      include,
    })
    return NextResponse.json(rows)
  })
}

/**
 * POST /api/school/:orgId/announcements { title, body, groupId?, audience?, pinned? }
 * Managers post to the whole school or any class; teachers only to classes
 * they teach. Recipients get an in-app notification.
 */
export async function POST(request: Request, { params }: Params) {
  return run("Create announcement", async () => {
    const session = await requireUser()
    const { canManage } = await requireSchoolAccess(params.orgId, session.user, false)
    const body = await readJson(request)
    const title = cleanText(body.title, 200)
    if (!title) throw new ApiError(400, "Title is required", { field: "title", code: "required" })
    const text = cleanText(body.body, 10000)
    if (!text) throw new ApiError(400, "Message is required", { field: "body", code: "required" })
    const audience = (body.audience ?? "ALL") as Audience
    if (!AUDIENCES.includes(audience)) throw new ApiError(400, "Invalid audience", { field: "audience", code: "invalid" })
    if (body.pinned !== undefined && typeof body.pinned !== "boolean") {
      throw new ApiError(400, "pinned must be true or false", { field: "pinned" })
    }
    let groupId: string | null = null
    if (body.groupId) groupId = (await requireOrgGroup(params.orgId, body.groupId)).id
    if (!canManage) {
      if (!groupId || !(await groupTeachingAccess(groupId, session.user))) {
        throw new ApiError(403, "Teachers can only post to classes they teach")
      }
    }
    const announcement = await db.announcement.create({
      data: {
        organizationId: params.orgId,
        groupId,
        authorId: session.user.id,
        title,
        body: text,
        audience,
        pinned: canManage ? !!body.pinned : false,
      },
      include,
    })
    const recipients = (await announcementRecipients({ organizationId: params.orgId, groupId, audience })).filter(
      (id) => id !== session.user.id
    )
    if (recipients.length) {
      const link = audience === "TEACHERS" ? `/org/${params.orgId}/school/announcements` : "/student/announcements"
      await db.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          type: "SYSTEM" as const,
          title: `إعلان: ${title}`,
          message: text.slice(0, 300),
          link,
        })),
      })
    }
    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "announcement.created",
      entityType: "announcement",
      entityId: announcement.id,
      summary: `Posted announcement "${title}" to ${announcement.group?.name ?? "the whole school"} (${audience})`,
      metadata: { organizationId: params.orgId, groupId, audience, recipients: recipients.length },
    })
    return NextResponse.json({ ...announcement, notified: recipients.length }, { status: 201 })
  })
}
