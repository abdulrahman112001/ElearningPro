import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// Get user details
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        role: true,
        isBlocked: true,
        isVerified: true,
        createdAt: true,
        courses: {
          select: {
            id: true,
            titleEn: true,
            status: true,
            totalStudents: true,
          },
        },
        enrollments: {
          select: {
            id: true,
            course: {
              select: {
                id: true,
                titleEn: true,
              },
            },
            progress: true,
            isCompleted: true,
          },
        },
        instructorProfile: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get user error:", error)
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 })
  }
}

// Update user
export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await readJson(request)
    const { role, isBlocked, isVerified } = body

    if (role !== undefined && !["ADMIN", "INSTRUCTOR", "STUDENT"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    if (
      (isBlocked !== undefined && typeof isBlocked !== "boolean") ||
      (isVerified !== undefined && typeof isVerified !== "boolean")
    ) {
      return NextResponse.json({ error: "Invalid flags" }, { status: 400 })
    }
    if (params.userId === session.user.id && isBlocked === true) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 })
    }

    // Prevent self-demotion
    if (params.userId === session.user.id && role && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      )
    }

    const user = await db.user.update({
      where: { id: params.userId },
      data: {
        ...(role && { role }),
        ...(typeof isBlocked === "boolean" && { isBlocked }),
        ...(typeof isVerified === "boolean" && { isVerified }),
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update user error:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

// Delete user
export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Prevent self-deletion
    if (params.userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete yourself" },
        { status: 400 }
      )
    }

    await db.user.delete({
      where: { id: params.userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
