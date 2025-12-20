import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

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
            title: true,
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
                title: true,
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

    const body = await request.json()
    const { role, isBlocked, isVerified } = body

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
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
