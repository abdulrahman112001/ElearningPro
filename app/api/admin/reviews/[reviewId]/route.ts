import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-error"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function DELETE(
  request: Request,
  { params }: { params: { reviewId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const review = await db.review.findUnique({ where: { id: params.reviewId } })
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    // Delete and recompute the course's denormalized rating together, so the
    // course card never shows a rating that includes a deleted review.
    await db.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: review.id } })
      const agg = await tx.review.aggregate({
        where: { courseId: review.courseId },
        _avg: { rating: true },
        _count: true,
      })
      await tx.course.update({
        where: { id: review.courseId },
        data: { averageRating: agg._avg.rating ?? 0, totalReviews: agg._count },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Delete review error:", error)
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    )
  }
}
