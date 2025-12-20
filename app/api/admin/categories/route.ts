import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Get categories (Admin only)
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const categories = await db.category.findMany({
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
        parent: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
        children: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
      },
      orderBy: { nameEn: "asc" },
    })

    const formatted = categories.map((category) => ({
      ...category,
      name: category.nameEn,
      parent: category.parent
        ? {
            ...category.parent,
            name: category.parent.nameEn,
          }
        : null,
      children: category.children.map((child) => ({
        ...child,
        name: child.nameEn,
      })),
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error("Get categories error:", error)
    return NextResponse.json(
      { error: "Failed to get categories" },
      { status: 500 }
    )
  }
}

// Create category (Admin only)
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, description, icon, parentId } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      )
    }

    // Check slug uniqueness
    const existing = await db.category.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 400 }
      )
    }

    const category = await db.category.create({
      data: {
        nameEn: name,
        nameAr: name,
        slug,
        description,
        icon,
        parentId,
      },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
        parent: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
        children: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
      },
    })

    const formatted = {
      ...category,
      name: category.nameEn,
      parent: category.parent
        ? {
            ...category.parent,
            name: category.parent.nameEn,
          }
        : null,
      children: category.children.map((child) => ({
        ...child,
        name: child.nameEn,
      })),
    }

    return NextResponse.json(formatted)
  } catch (error) {
    console.error("Create category error:", error)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}
