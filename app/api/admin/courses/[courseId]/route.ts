import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Review course (Admin only)
export async function PATCH(
  request: Request,
  { params }: { params: { courseId: string } }
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
    const { action, reason } = body

    if (!["approve", "reject", "feature", "unfeature"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const course = await db.course.findUnique({
      where: { id: params.courseId },
      include: {
        instructor: {
          select: { id: true, name: true },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    let updateData: any = {}
    let notificationTitle = ""
    let notificationMessage = ""

    switch (action) {
      case "approve":
        updateData = {
          status: "PUBLISHED",
          publishedAt: new Date(),
        }
        notificationTitle = "Course Approved!"
        notificationMessage = `Your course "${course.title}" has been approved and is now live.`
        break

      case "reject":
        updateData = {
          status: "REJECTED",
        }
        notificationTitle = "Course Rejected"
        notificationMessage = `Your course "${
          course.title
        }" was not approved. Reason: ${reason || "Please review guidelines."}`
        break

      case "feature":
        updateData = { isFeatured: true }
        notificationTitle = "Course Featured!"
        notificationMessage = `Your course "${course.title}" has been featured on the homepage.`
        break

      case "unfeature":
        updateData = { isFeatured: false }
        break
    }

    const updatedCourse = await db.course.update({
      where: { id: params.courseId },
      data: updateData,
    })

    // Notify instructor
    if (notificationTitle) {
      await db.notification.create({
        data: {
          userId: course.instructorId,
          type: "COURSE_PUBLISHED",
          title: notificationTitle,
          message: notificationMessage,
          link: `/instructor/courses/${course.id}`,
        },
      })
    }

    return NextResponse.json(updatedCourse)
  } catch (error) {
    console.error("Review course error:", error)
    return NextResponse.json(
      { error: "Failed to review course" },
      { status: 500 }
    )
  }
}
