import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-error"

// DELETE /api/wishlist/:id  (:id is the wishlist item id or the course id)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Scoped to the caller, so nobody can remove another user's items.
    const { count } = await db.wishlist.deleteMany({
      where: {
        userId: session.user.id,
        OR: [{ id: params.id }, { courseId: params.id }],
      },
    })
    if (count === 0) {
      return NextResponse.json({ error: "Wishlist item not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Remove from wishlist error:", error)
    return NextResponse.json({ error: "Failed to remove from wishlist" }, { status: 500 })
  }
}
