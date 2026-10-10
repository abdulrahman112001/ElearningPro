import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getCourseAccess } from "@/lib/access"
import { apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit"
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  VIEW_WINDOW_MS,
  allowedViews,
  getSecuritySettings,
  isValidDeviceId,
  newDeviceId,
  registerDevice,
  watermarkText,
} from "@/lib/video-protection"

export const dynamic = "force-dynamic"

/**
 * Hands the video URL of a lesson to a viewer who may watch it, after
 * enforcing the device limit and the per-student view limit. The learn page
 * never embeds the URL itself.
 */
export async function POST(request: Request, { params }: { params: { lessonId: string } }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = session.user

    const limit = rateLimit({ scope: "lesson-play", identifier: user.id, limit: 60, windowMs: 60_000 })
    if (!limit.success) return tooManyRequests(limit.resetAt)

    const lesson = await db.lesson.findUnique({
      where: { id: params.lessonId },
      select: {
        id: true,
        titleEn: true,
        videoUrl: true,
        videoProvider: true,
        isPublished: true,
        isFree: true,
        isPreview: true,
        maxViews: true,
        chapter: {
          select: {
            isPublished: true,
            isFree: true,
            course: {
              select: {
                id: true,
                titleEn: true,
                status: true,
                instructorId: true,
                classGroupId: true,
                watermarkEnabled: true,
              },
            },
          },
        },
      },
    })
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }
    const course = lesson.chapter.course
    const privileged = course.instructorId === user.id || user.role === "ADMIN"

    if (!privileged) {
      const visible =
        lesson.isPublished && lesson.chapter.isPublished && course.status === "PUBLISHED"
      if (!visible) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
      }
      const access = await getCourseAccess(user, course)
      const freeLesson = lesson.isFree || lesson.isPreview || lesson.chapter.isFree
      if (!access.allowed && !freeLesson) {
        return NextResponse.json({ error: "No access to this lesson", code: access.reason }, { status: 403 })
      }
    }

    if (!lesson.videoUrl) {
      return NextResponse.json({ error: "This lesson has no video", code: "no_video" }, { status: 404 })
    }

    const viewer = await db.user.findUnique({
      where: { id: user.id },
      select: { name: true, phone: true, email: true },
    })
    const watermark = {
      enabled: course.watermarkEnabled,
      text: viewer ? watermarkText(viewer) : "",
    }

    if (privileged) {
      return NextResponse.json({
        videoUrl: lesson.videoUrl,
        videoProvider: lesson.videoProvider,
        viewsUsed: 0,
        viewsAllowed: null,
        watermark,
      })
    }

    // ---- Device limit -------------------------------------------------------
    const settings = await getSecuritySettings()
    const cookieValue = cookies().get(DEVICE_COOKIE)?.value
    const deviceId = isValidDeviceId(cookieValue) ? cookieValue : newDeviceId()
    const setDeviceCookie = (res: NextResponse) => {
      if (cookieValue !== deviceId) {
        res.cookies.set(DEVICE_COOKIE, deviceId, {
          httpOnly: true,
          sameSite: "lax",
          secure: new URL(request.url).protocol === "https:",
          path: "/",
          maxAge: DEVICE_COOKIE_MAX_AGE,
        })
      }
      return res
    }

    const ip = getClientIp(request)
    const device = await registerDevice({
      userId: user.id,
      deviceId,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      ip: ip === "unknown" ? null : ip,
      maxDevices: settings.maxDevices,
    })
    if (!device.ok) {
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        action: "video.device_limit_reached",
        entityType: "user",
        entityId: user.id,
        summary: `Device limit (${settings.maxDevices}) reached while opening "${lesson.titleEn}"`,
        metadata: { lessonId: lesson.id, courseId: course.id, maxDevices: settings.maxDevices },
      })
      return setDeviceCookie(
        NextResponse.json(
          {
            error: "Device limit reached",
            code: "device_limit",
            maxDevices: settings.maxDevices,
            devices: device.devices.map((d) => ({
              id: d.id,
              label: d.label,
              firstSeenAt: d.firstSeenAt,
              lastSeenAt: d.lastSeenAt,
            })),
          },
          { status: 403 }
        )
      )
    }

    // ---- View limit ---------------------------------------------------------
    const now = new Date()
    const existing = await db.lessonView.findUnique({
      where: { lessonId_userId: { lessonId: lesson.id, userId: user.id } },
    })
    const extra = existing?.extraViews ?? 0
    const allowed = allowedViews(lesson.maxViews, settings.defaultMaxViews, extra)
    const used = existing?.count ?? 0
    const isNewView =
      !existing || existing.count === 0 || now.getTime() - existing.lastViewedAt.getTime() >= VIEW_WINDOW_MS

    if (isNewView && allowed !== null && used >= allowed) {
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        action: "video.view_limit_reached",
        entityType: "lesson",
        entityId: lesson.id,
        summary: `View limit (${allowed}) reached on "${lesson.titleEn}"`,
        metadata: { lessonId: lesson.id, courseId: course.id, viewsUsed: used, viewsAllowed: allowed },
      })
      return setDeviceCookie(
        NextResponse.json(
          { error: "View limit reached", code: "view_limit_reached", viewsUsed: used, viewsAllowed: allowed },
          { status: 403 }
        )
      )
    }

    let viewsUsed = used
    if (isNewView) {
      if (!existing) {
        const created = await db.lessonView.upsert({
          where: { lessonId_userId: { lessonId: lesson.id, userId: user.id } },
          update: { count: { increment: 1 }, lastViewedAt: now },
          create: { lessonId: lesson.id, userId: user.id, count: 1, lastViewedAt: now },
        })
        viewsUsed = created.count
      } else {
        // Conditional update: two tabs opening at once count only one view.
        const res = await db.lessonView.updateMany({
          where: {
            id: existing.id,
            OR: [{ count: 0 }, { lastViewedAt: { lte: new Date(now.getTime() - VIEW_WINDOW_MS) } }],
          },
          data: { count: { increment: 1 }, lastViewedAt: now },
        })
        viewsUsed = res.count > 0 ? used + 1 : used
      }
    }

    return setDeviceCookie(
      NextResponse.json({
        videoUrl: lesson.videoUrl,
        videoProvider: lesson.videoProvider,
        viewsUsed,
        viewsAllowed: allowed,
        watermark,
      })
    )
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Lesson play error:", error)
    return NextResponse.json({ error: "Failed to load the video" }, { status: 500 })
  }
}
