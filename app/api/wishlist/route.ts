import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// GET /api/wishlist?courseId=... -> { wishlisted } ; without courseId -> the user's list
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const courseId = new URL(request.url).searchParams.get("courseId")
    if (courseId) {
      const item = await db.wishlist.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId } },
        select: { id: true },
      })
      return NextResponse.json({ wishlisted: !!item, id: item?.id ?? null })
    }
    const items = await db.wishlist.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, courseId: true, createdAt: true },
    })
    return NextResponse.json(items)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get wishlist error:", error)
    return NextResponse.json({ error: "Failed to get wishlist" }, { status: 500 })
  }
}

// POST /api/wishlist { courseId } -> add (idempotent)
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { courseId } = await readJson(request)
    if (typeof courseId !== "string" || !courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }
    const course = await db.course.findFirst({
      where: { id: courseId, status: "PUBLISHED" },
      select: { id: true },
    })
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }
    const item = await db.wishlist.upsert({
      where: { userId_courseId: { userId: session.user.id, courseId } },
      update: {},
      create: { userId: session.user.id, courseId },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Add to wishlist error:", error)
    return NextResponse.json({ error: "Failed to add to wishlist" }, { status: 500 })
  }
}
