import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import { sendEmail } from "@/lib/email"
import { APPLICATION_SELECT, effectiveApplicationStatus } from "@/lib/instructor-application"

const VALID_ACTIONS = ["approve", "reject", "revoke"] as const

type InstructorAction = (typeof VALID_ACTIONS)[number]

async function requireAdminSession() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

// GET - an instructor's full application, for the admin review dialog
export async function GET(
  _request: Request,
  { params }: { params: { instructorId: string } }
) {
  try {
    const { session, error } = await requireAdminSession()
    if (!session) return error

    const user = await db.user.findUnique({
      where: { id: params.instructorId, role: "INSTRUCTOR" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        headline: true,
        bio: true,
        linkedin: true,
        youtube: true,
        createdAt: true,
        instructorProfile: { select: APPLICATION_SELECT },
      },
    })
    if (!user) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
    }

    const gradeLevelIds = user.instructorProfile?.gradeLevelIds ?? []
    const gradeLevels = gradeLevelIds.length
      ? await db.gradeLevel.findMany({
          where: { id: { in: gradeLevelIds } },
          select: { id: true, nameAr: true, nameEn: true },
          orderBy: { position: "asc" },
        })
      : []

    const { instructorProfile, ...account } = user
    return NextResponse.json({
      status: effectiveApplicationStatus(instructorProfile),
      user: account,
      application: instructorProfile,
      gradeLevels,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get instructor application error:", error)
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 })
  }
}

// PATCH - approve, reject (with a reason) or revoke an instructor
export async function PATCH(
  request: Request,
  { params }: { params: { instructorId: string } }
) {
  try {
    const { session, error } = await requireAdminSession()
    if (!session) return error

    const body = await readJson(request)
    const action: InstructorAction = body.action

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : ""
    if (action === "reject" && !reason) {
      return NextResponse.json(
        { error: "A rejection reason is required", code: "reason_required" },
        { status: 400 }
      )
    }

    const instructor = await db.user.findUnique({
      where: { id: params.instructorId, role: "INSTRUCTOR" },
      select: { id: true, name: true, email: true },
    })

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor not found" },
        { status: 404 }
      )
    }

    const approved = action === "approve"
    const now = new Date()
    const review = {
      isApproved: approved,
      approvedAt: approved ? now : null,
      applicationStatus: approved ? ("APPROVED" as const) : ("REJECTED" as const),
      reviewedAt: now,
      reviewedById: session.user.id,
      rejectionReason: approved ? null : reason || null,
    }

    const profile = await db.instructorProfile.upsert({
      where: { userId: params.instructorId },
      update: review,
      create: { userId: params.instructorId, ...review },
    })

    const copy = {
      approve: {
        title: "Instructor application approved",
        message: "Congratulations! Your instructor application has been approved. You can now create courses.",
        link: "/instructor",
      },
      reject: {
        title: "Instructor application needs changes",
        message: `Your instructor application was not approved: ${reason}`,
        link: "/instructor-application",
      },
      revoke: {
        title: "Instructor approval revoked",
        message: reason
          ? `Your instructor approval has been revoked: ${reason}`
          : "Your instructor approval has been revoked. Please contact support for more details.",
        link: "/instructor-application",
      },
    }[action]

    await db.notification.create({
      data: { userId: params.instructorId, type: "SYSTEM", ...copy },
    })

    // Email is best effort: the in-app notification is the record.
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
      await sendEmail({
        to: instructor.email,
        subject: copy.title,
        html: `<p>${escapeHtml(instructor.name || "")}</p><p>${escapeHtml(copy.message)}</p><p><a href="${appUrl}${copy.link}">${appUrl}${copy.link}</a></p>`,
      })
    } catch (emailError) {
      console.error("Instructor review email failed:", emailError)
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action:
        action === "approve"
          ? "instructor.approved"
          : action === "reject"
            ? "instructor.rejected"
            : "instructor.revoked",
      entityType: "user",
      entityId: instructor.id,
      summary: `${instructor.name} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "revoked"} as instructor`,
      metadata: reason ? { reason } : undefined,
    })

    return NextResponse.json(profile)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Instructor approval error:", error)
    return NextResponse.json(
      { error: "Failed to update instructor" },
      { status: 500 }
    )
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
