import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Update course
export async function PATCH(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const course = await db.course.findUnique({
      where: {
        id: params.courseId,
        instructorId: session.user.id,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      titleAr,
      description,
      descriptionAr,
      shortDescription,
      shortDescriptionAr,
      price,
      discountPrice,
      categoryId,
      level,
      language,
      requirements,
      objectives,
      targetAudience,
      thumbnail,
      previewVideo,
    } = body

    const updatedCourse = await db.course.update({
      where: { id: params.courseId },
      data: {
        titleEn: title,
        titleAr,
        descriptionEn: description,
        descriptionAr,
        shortDescEn: shortDescription,
        shortDescAr: shortDescriptionAr,
        price,
        discountPrice,
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        level,
        language,
        // Convert string to array if needed - use whatYouLearn for objectives
        requirements: requirements
          ? Array.isArray(requirements)
            ? requirements
            : [requirements]
          : [],
        whatYouLearn: objectives
          ? Array.isArray(objectives)
            ? objectives
            : [objectives]
          : [],
        // targetAudience is not in schema, skip it
        thumbnail,
        promoVideo: previewVideo,
      },
    })

    return NextResponse.json(updatedCourse)
  } catch (error) {
    console.error("Update course error:", error)
    return NextResponse.json(
      { error: "Failed to update course" },
      { status: 500 }
    )
  }
}

// Delete course
export async function DELETE(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const course = await db.course.findUnique({
      where: {
        id: params.courseId,
        instructorId: session.user.id,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // Check for enrollments
    const enrollmentCount = await db.enrollment.count({
      where: { courseId: params.courseId },
    })

    if (enrollmentCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete course with enrollments" },
        { status: 400 }
      )
    }

    await db.course.delete({
      where: { id: params.courseId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete course error:", error)
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    )
  }
}
