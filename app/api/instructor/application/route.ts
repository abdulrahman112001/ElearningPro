import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { logActivity } from "@/lib/activity"
import {
  APPLICATION_SELECT,
  effectiveApplicationStatus,
  parseApplication,
} from "@/lib/instructor-application"

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  headline: true,
  bio: true,
  linkedin: true,
  youtube: true,
} as const

// GET - the signed-in instructor's application and its review status
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { ...USER_SELECT, instructorProfile: { select: APPLICATION_SELECT } },
    })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { instructorProfile, ...account } = user
    return NextResponse.json({
      status: effectiveApplicationStatus(instructorProfile),
      user: account,
      application: instructorProfile,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get instructor application error:", error)
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 })
  }
}

// PUT - submit (or resubmit) the application; it then waits for an admin
export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const existing = await db.instructorProfile.findUnique({
      where: { userId: session.user.id },
      select: { isApproved: true },
    })
    if (existing?.isApproved) {
      return NextResponse.json(
        { error: "Application already approved", code: "already_approved" },
        { status: 409 }
      )
    }

    const parsed = parseApplication(await readJson(request))
    if (parsed.errors) {
      return NextResponse.json(
        { error: "Invalid application", code: "validation", fields: parsed.errors },
        { status: 400 }
      )
    }
    const { data } = parsed

    // Keep only grade levels that exist and are offered.
    const grades = data.profile.gradeLevelIds.length
      ? await db.gradeLevel.findMany({
          where: { id: { in: data.profile.gradeLevelIds }, isActive: true },
          select: { id: true },
        })
      : []
    const now = new Date()
    const profileData = {
      ...data.profile,
      gradeLevelIds: grades.map((g) => g.id),
      applicationStatus: "PENDING" as const,
      submittedAt: now,
      reviewedAt: null,
      reviewedById: null,
      rejectionReason: null,
      agreedToTermsAt: now,
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name,
        headline: data.headline,
        bio: data.bio,
        linkedin: data.linkedin,
        youtube: data.youtube,
        instructorProfile: {
          upsert: {
            create: { ...profileData, isApproved: false },
            update: profileData,
          },
        },
      },
      select: { ...USER_SELECT, instructorProfile: { select: APPLICATION_SELECT } },
    })

    // Tell every admin there is an application to review.
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "SYSTEM" as const,
          title: "New instructor application",
          message: `${data.name} submitted an instructor application for review.`,
          link: "/admin/instructors?status=pending",
        })),
      })
    }

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "instructor.application_submitted",
      entityType: "user",
      entityId: session.user.id,
      summary: `${data.name} submitted an instructor application (${data.profile.specialization})`,
      metadata: { specialization: data.profile.specialization, governorate: data.profile.governorate },
    })

    const { instructorProfile, ...account } = user
    return NextResponse.json({
      status: effectiveApplicationStatus(instructorProfile),
      user: account,
      application: instructorProfile,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Submit instructor application error:", error)
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 })
  }
}
