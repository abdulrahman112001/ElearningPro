import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(
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
      include: {
        chapters: {
          include: { lessons: true },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // Validation checks
    const errors: string[] = []
    const errorsAr: string[] = []

    if (!course.titleEn) {
      errors.push("Course title is required")
      errorsAr.push("عنوان الكورس مطلوب")
    }
    if (!course.descriptionEn) {
      errors.push("Course description is required")
      errorsAr.push("وصف الكورس مطلوب")
    }
    if (!course.categoryId) {
      errors.push("Category is required")
      errorsAr.push("التصنيف مطلوب")
    }
    if (course.chapters.length === 0) {
      errors.push("At least one chapter is required")
      errorsAr.push("يجب إضافة فصل واحد على الأقل")
    }

    const hasPublishedLesson = course.chapters.some((ch) =>
      ch.lessons.some((l) => l.isPublished)
    )
    if (!hasPublishedLesson) {
      errors.push("At least one published lesson is required")
      errorsAr.push("يجب إضافة درس منشور واحد على الأقل في أحد الفصول")
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors, errorsAr }, { status: 400 })
    }

    // Calculate total duration
    let totalDuration = 0
    let totalLessons = 0

    course.chapters.forEach((chapter) => {
      chapter.lessons.forEach((lesson) => {
        if (lesson.isPublished) {
          totalLessons++
          totalDuration += lesson.duration || 0
        }
      })
    })

    // Update course status
    const updatedCourse = await db.course.update({
      where: { id: params.courseId },
      data: {
        status: "PUBLISHED",
        totalDuration,
        totalLessons,
        publishedAt: new Date(),
      },
    })

    // Also publish all chapters that have published lessons
    for (const chapter of course.chapters) {
      const hasPublishedLesson = chapter.lessons.some((l) => l.isPublished)
      if (hasPublishedLesson && !chapter.isPublished) {
        await db.chapter.update({
          where: { id: chapter.id },
          data: { isPublished: true },
        })
      }
    }

    return NextResponse.json(updatedCourse)
  } catch (error) {
    console.error("Publish course error:", error)
    return NextResponse.json(
      { error: "Failed to publish course" },
      { status: 500 }
    )
  }
}
