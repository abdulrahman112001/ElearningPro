import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Update chapter
export async function PATCH(
  request: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const chapter = await db.chapter.findFirst({
      where: {
        id: params.chapterId,
        courseId: params.courseId,
        course: {
          instructorId: session.user.id,
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    const body = await request.json()
    const { title, titleAr, description, descriptionAr, isPublished } = body

    const updatedChapter = await db.chapter.update({
      where: { id: params.chapterId },
      data: {
        titleEn: title,
        titleAr,
        descriptionEn: description,
        descriptionAr,
        isPublished,
      },
    })

    return NextResponse.json(updatedChapter)
  } catch (error) {
    console.error("Update chapter error:", error)
    return NextResponse.json(
      { error: "Failed to update chapter" },
      { status: 500 }
    )
  }
}

// Delete chapter
export async function DELETE(
  request: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const chapter = await db.chapter.findFirst({
      where: {
        id: params.chapterId,
        courseId: params.courseId,
        course: {
          instructorId: session.user.id,
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    // Delete chapter (cascades to lessons)
    await db.chapter.delete({
      where: { id: params.chapterId },
    })

    // Reorder remaining chapters
    const remainingChapters = await db.chapter.findMany({
      where: { courseId: params.courseId },
      orderBy: { position: "asc" },
    })

    await db.$transaction(
      remainingChapters.map((ch, index) =>
        db.chapter.update({
          where: { id: ch.id },
          data: { position: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete chapter error:", error)
    return NextResponse.json(
      { error: "Failed to delete chapter" },
      { status: 500 }
    )
  }
}
