import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { resolveCourseAudience } from "@/lib/course-audience"

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

    const body = await readJson(request)
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

    // Prices: non-negative numbers, and a discount may not exceed the price.
    const isMoney = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0
    if (price !== undefined && !isMoney(price)) {
      return NextResponse.json({ error: "Price must be a non-negative number" }, { status: 400 })
    }
    if (discountPrice !== undefined && discountPrice !== null && !isMoney(discountPrice)) {
      return NextResponse.json({ error: "Discount price must be a non-negative number" }, { status: 400 })
    }
    const effectivePrice = price !== undefined ? price : course.price
    if (typeof discountPrice === "number" && discountPrice > effectivePrice) {
      return NextResponse.json({ error: "Discount price cannot exceed the price" }, { status: 400 })
    }

    const audience = await resolveCourseAudience(session.user.id, {
      gradeLevelId: body.gradeLevelId,
      classGroupId: body.classGroupId,
    })

    const toList = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : [])

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
        // Only touch the lists when the client sent them: a partial PATCH
        // (e.g. just the title) must not wipe requirements/objectives.
        ...(requirements !== undefined && { requirements: toList(requirements) }),
        ...(objectives !== undefined && { whatYouLearn: toList(objectives) }),
        // targetAudience is not in schema, skip it
        thumbnail,
        promoVideo: previewVideo,
        ...audience,
      },
    })

    return NextResponse.json(updatedCourse)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
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
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete course error:", error)
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    )
  }
}
