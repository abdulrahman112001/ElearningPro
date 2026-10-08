import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import slugify from "slugify"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { resolveCourseAudience } from "@/lib/course-audience"
import { pendingInstructorResponse } from "@/lib/instructor-guard"
import { logActivity } from "@/lib/activity"

// POST - Create a new course (instructor only)
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only instructors can create courses" },
        { status: 403 }
      )
    }
    const pending = pendingInstructorResponse(session)
    if (pending) return pending

    const body = await readJson(request)
    const { title, titleAr, description, categoryId, level, language } = body

    if (!title || !description || !categoryId || !level || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const audience = await resolveCourseAudience(session.user.id, {
      gradeLevelId: body.gradeLevelId,
      classGroupId: body.classGroupId,
    })

    // Generate unique slug
    let slug = slugify(title, { lower: true, strict: true })
    const existingCourse = await db.course.findUnique({ where: { slug } })
    if (existingCourse) {
      slug = `${slug}-${Date.now()}`
    }

    const course = await db.course.create({
      data: {
        titleEn: title,
        titleAr: titleAr || title,
        slug,
        descriptionEn: description,
        descriptionAr: titleAr ? description : null,
        categoryId,
        level,
        language,
        instructorId: session.user.id,
        status: "DRAFT",
        ...audience,
      },
    })

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "course.created",
      entityType: "course",
      entityId: course.id,
      summary: `Created course "${course.titleEn}"`,
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Error creating course:", error)
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    )
  }
}

// GET - Fetch instructor's courses
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const courses = await db.course.findMany({
      where: { instructorId: session.user.id },
      include: {
        category: true,
        _count: {
          select: {
            enrollments: true,
            reviews: true,
            chapters: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(courses)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Error fetching instructor courses:", error)
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    )
  }
}
