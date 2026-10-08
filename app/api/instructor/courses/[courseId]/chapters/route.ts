import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// Get chapters
export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const course = await db.course.findUnique({
      where: {
        id: params.courseId,
        instructorId: session.user.id,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const chapters = await db.chapter.findMany({
      where: { courseId: params.courseId },
      orderBy: { position: "asc" },
      include: {
        lessons: {
          orderBy: { position: "asc" },
        },
      },
    })

    return NextResponse.json(chapters)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get chapters error:", error)
    return NextResponse.json(
      { error: "Failed to get chapters" },
      { status: 500 }
    )
  }
}

// Create chapter
export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
    const { title, titleAr, position } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Get next position if not provided
    let chapterPosition = position
    if (chapterPosition === undefined) {
      const lastChapter = await db.chapter.findFirst({
        where: { courseId: params.courseId },
        orderBy: { position: "desc" },
      })
      chapterPosition = (lastChapter?.position ?? -1) + 1
    }

    const chapter = await db.chapter.create({
      data: {
        titleEn: title,
        titleAr: titleAr || title,
        position: chapterPosition,
        courseId: params.courseId,
      },
    })

    return NextResponse.json(chapter, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create chapter error:", error)
    return NextResponse.json(
      { error: "Failed to create chapter" },
      { status: 500 }
    )
  }
}

// Reorder chapters
export async function PUT(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
    const { chapters } = body // Array of { id, position }

    if (
      !Array.isArray(chapters) ||
      !chapters.every((ch: any) => typeof ch?.id === "string" && Number.isInteger(ch?.position))
    ) {
      return NextResponse.json({ error: "chapters must be an array of { id, position }" }, { status: 400 })
    }

    // Scope every update to this course: ids of chapters that belong to
    // another course (or another instructor) match nothing.
    const results = await db.$transaction(
      chapters.map((ch: { id: string; position: number }) =>
        db.chapter.updateMany({
          where: { id: ch.id, courseId: course.id },
          data: { position: ch.position },
        })
      )
    )
    if (results.some((r) => r.count !== 1)) {
      return NextResponse.json({ error: "Chapter not found in this course" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Reorder chapters error:", error)
    return NextResponse.json(
      { error: "Failed to reorder chapters" },
      { status: 500 }
    )
  }
}
