import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const VALID_ACTIONS = ["approve", "revoke"] as const

type InstructorAction = (typeof VALID_ACTIONS)[number]

export async function PATCH(
  request: Request,
  { params }: { params: { instructorId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const action: InstructorAction = body.action

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const instructor = await db.user.findUnique({
      where: { id: params.instructorId, role: "INSTRUCTOR" },
      select: { id: true, name: true },
    })

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor not found" },
        { status: 404 }
      )
    }

    const approved = action === "approve"

    const profile = await db.instructorProfile.upsert({
      where: { userId: params.instructorId },
      update: {
        isApproved: approved,
        approvedAt: approved ? new Date() : null,
      },
      create: {
        userId: params.instructorId,
        isApproved: approved,
        approvedAt: approved ? new Date() : null,
      },
    })

    await db.notification.create({
      data: {
        userId: params.instructorId,
        type: approved ? "SYSTEM" : "SYSTEM",
        title: approved ? "Instructor Approved" : "Instructor Approval Revoked",
        message: approved
          ? "Congratulations! Your instructor profile has been approved."
          : "Your instructor approval has been revoked. Please contact support for more details.",
        link: "/instructor/dashboard",
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error("Instructor approval error:", error)
    return NextResponse.json(
      { error: "Failed to update instructor" },
      { status: 500 }
    )
  }
}
