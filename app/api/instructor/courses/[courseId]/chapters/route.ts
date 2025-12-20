import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

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

    const body = await request.json()
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

    const body = await request.json()
    const { chapters } = body // Array of { id, position }

    // Update positions in transaction
    await db.$transaction(
      chapters.map((ch: { id: string; position: number }) =>
        db.chapter.update({
          where: { id: ch.id },
          data: { position: ch.position },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reorder chapters error:", error)
    return NextResponse.json(
      { error: "Failed to reorder chapters" },
      { status: 500 }
    )
  }
}
