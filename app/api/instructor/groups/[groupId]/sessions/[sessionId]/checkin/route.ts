import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"
import {
  appOrigin,
  CANCELLED_MODE,
  findGroupSession,
  QR_ROTATE_AFTER_MS,
  QR_TTL_MS,
  requireGroupManager,
  rotateQrToken,
} from "@/lib/attendance"

type Params = { params: { groupId: string; sessionId: string } }

async function state(request: Request, sessionId: string, groupId: string, token: string | null, expiresAt: Date | null) {
  const active = !!token && !!expiresAt && expiresAt > new Date()
  const [members, records] = await Promise.all([
    db.classGroupMember.count({ where: { groupId } }),
    db.attendanceRecord.findMany({
      where: { sessionId, method: "QR" },
      orderBy: { markedAt: "desc" },
      select: { status: true, markedAt: true, student: { select: { id: true, name: true, image: true } } },
    }),
  ])
  let url: string | null = null
  let svg: string | null = null
  if (active) {
    url = `${appOrigin(request)}/checkin?t=${encodeURIComponent(token!)}`
    svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
  }
  return {
    active,
    token: active ? token : null,
    url,
    svg,
    expiresAt: active ? expiresAt : null,
    checkedIn: records.length,
    late: records.filter((r) => r.status === "LATE").length,
    members,
    recent: records.slice(0, 12),
  }
}

// GET .../checkin: live state for the QR screen. While check-in is running the
// token is rotated once it is older than ~30s, so a photo of the code dies fast.
export async function GET(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await findGroupSession(params.groupId, params.sessionId)
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    let { qrToken, qrExpiresAt } = session
    const now = Date.now()
    if (qrToken && qrExpiresAt && qrExpiresAt.getTime() > now) {
      const age = QR_TTL_MS - (qrExpiresAt.getTime() - now)
      if (age >= QR_ROTATE_AFTER_MS) ({ qrToken, qrExpiresAt } = await rotateQrToken(session.id))
    }
    return NextResponse.json(await state(request, session.id, params.groupId, qrToken, qrExpiresAt))
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Check-in state error:", error)
    return NextResponse.json({ error: "Failed to load check-in" }, { status: 500 })
  }
}

// POST .../checkin: start check-in (or force a new token)
export async function POST(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await findGroupSession(params.groupId, params.sessionId)
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    if (session.mode === CANCELLED_MODE) {
      return NextResponse.json({ error: "The session is cancelled", code: "cancelled" }, { status: 409 })
    }
    const { qrToken, qrExpiresAt } = await rotateQrToken(session.id)
    return NextResponse.json(await state(request, session.id, params.groupId, qrToken, qrExpiresAt))
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Start check-in error:", error)
    return NextResponse.json({ error: "Failed to start check-in" }, { status: 500 })
  }
}

// DELETE .../checkin: stop check-in (the code stops working immediately)
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { error } = await requireGroupManager(params.groupId)
    if (error) return error
    const session = await findGroupSession(params.groupId, params.sessionId)
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    await db.groupSession.update({ where: { id: session.id }, data: { qrToken: null, qrExpiresAt: null } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Stop check-in error:", error)
    return NextResponse.json({ error: "Failed to stop check-in" }, { status: 500 })
  }
}
