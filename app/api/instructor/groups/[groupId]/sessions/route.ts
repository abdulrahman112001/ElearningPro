import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import {
  attendanceCounts,
  CANCELLED_MODE,
  parseSessionBody,
  requireGroupManager,
} from "@/lib/attendance"

type Params = { params: { groupId: string } }

// GET /api/instructor/groups/:id/sessions?scope=upcoming|past|all
// Sessions with attendance counts and the group's member count.
export async function GET(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const url = new URL(request.url)
    const scope = url.searchParams.get("scope") ?? "all"
    const now = new Date()
    // A session stays "upcoming" until it ends (or 3h after start without an end).
    const recent = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const where =
      scope === "upcoming"
        ? { groupId: params.groupId, startsAt: { gte: recent } }
        : scope === "past"
          ? { groupId: params.groupId, startsAt: { lt: now } }
          : { groupId: params.groupId }
    const [sessions, memberCount] = await Promise.all([
      db.groupSession.findMany({
        where,
        orderBy: { startsAt: scope === "upcoming" ? "asc" : "desc" },
        take: 200,
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          mode: true,
          location: true,
          notes: true,
          qrExpiresAt: true,
        },
      }),
      db.classGroupMember.count({ where: { groupId: params.groupId } }),
    ])
    const counts = await attendanceCounts(sessions.map((s) => s.id))
    return NextResponse.json({
      memberCount,
      sessions: sessions.map((s) => ({
        ...s,
        cancelled: s.mode === CANCELLED_MODE,
        checkinActive: !!s.qrExpiresAt && s.qrExpiresAt > now,
        counts: counts.get(s.id),
      })),
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("List sessions error:", error)
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 })
  }
}

// POST /api/instructor/groups/:id/sessions
// { date: "YYYY-MM-DD", time: "HH:mm" (Cairo) | startsAt: ISO, durationMin?, title?, mode?, location?, notes? }
export async function POST(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const group = await db.classGroup.findUniqueOrThrow({
      where: { id: params.groupId },
      select: { mode: true, location: true },
    })
    const parsed = parseSessionBody(await readJson(request), false)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const d = parsed.data
    const mode = d.mode ?? (group.mode === "ONLINE" ? "ONLINE" : "OFFLINE")
    const clash = await db.groupSession.findFirst({
      where: { groupId: params.groupId, startsAt: d.startsAt! },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json({ error: "A session already exists at this time", code: "duplicate_session" }, { status: 409 })
    }
    const created = await db.groupSession.create({
      data: {
        groupId: params.groupId,
        startsAt: d.startsAt!,
        endsAt: new Date(d.startsAt!.getTime() + (d.durationMin ?? 60) * 60000),
        title: d.title ?? null,
        mode,
        location: d.location !== undefined ? d.location : mode === "ONLINE" ? null : group.location,
        notes: d.notes ?? null,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create session error:", error)
    return NextResponse.json({ error: "Failed to create the session" }, { status: 500 })
  }
}
