import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-error"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import slugify from "slugify"

// GET - Fetch all courses (public)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const level = searchParams.get("level")
    const price = searchParams.get("price")
    const search = searchParams.get("search")
    const sort = searchParams.get("sort") || "newest"
    // Clamp pagination so ?page=0, negative or non-numeric values cannot
    // reach Prisma (which rejects a negative skip with a 500).
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12") || 12))

    const where: any = {
      status: "PUBLISHED",
    }

    if (category) {
      where.categoryId = category
    }

    if (level) {
      if (!["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"].includes(level)) {
        return NextResponse.json({ error: "Invalid level" }, { status: 400 })
      }
      where.level = level
    }

    if (price === "free") {
      where.price = 0
    } else if (price === "paid") {
      where.price = { gt: 0 }
    }

    if (search) {
      where.OR = [
        { titleEn: { contains: search, mode: "insensitive" } },
        { titleAr: { contains: search, mode: "insensitive" } },
        { descriptionEn: { contains: search, mode: "insensitive" } },
        { descriptionAr: { contains: search, mode: "insensitive" } },
      ]
    }

    let orderBy: any = { createdAt: "desc" }

    switch (sort) {
      case "popular":
        orderBy = { enrollments: { _count: "desc" } }
        break
      case "rating":
        orderBy = { averageRating: "desc" }
        break
      case "price-low":
        orderBy = { price: "asc" }
        break
      case "price-high":
        orderBy = { price: "desc" }
        break
    }

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          instructor: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          category: true,
          _count: {
            select: {
              enrollments: true,
              reviews: true,
            },
          },
        },
      }),
      db.course.count({ where }),
    ])

    return NextResponse.json({
      courses,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Error fetching courses:", error)
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    )
  }
}
