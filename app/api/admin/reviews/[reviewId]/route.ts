import { NextResponse } from "next/server"
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

    await db.review.delete({ where: { id: params.reviewId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete review error:", error)
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    )
  }
}
