import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import slugify from "slugify"

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

    const body = await request.json()
    const { title, titleAr, description, categoryId, level, language } = body

    if (!title || !description || !categoryId || !level || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

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
      },
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error) {
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
    console.error("Error fetching instructor courses:", error)
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    )
  }
}
