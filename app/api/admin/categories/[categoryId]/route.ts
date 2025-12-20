import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Update category
export async function PATCH(
  request: Request,
  { params }: { params: { categoryId: string } }
) {
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

    // Check slug uniqueness if changed
    if (slug) {
      const existing = await db.category.findFirst({
        where: {
          slug,
          id: { not: params.categoryId },
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 400 }
        )
      }
    }

    // Prevent circular parent reference
    if (parentId === params.categoryId) {
      return NextResponse.json(
        { error: "Category cannot be its own parent" },
        { status: 400 }
      )
    }

    const category = await db.category.update({
      where: { id: params.categoryId },
      data: {
        ...(name && { nameEn: name, nameAr: name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(parentId !== undefined && { parentId }),
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
    console.error("Update category error:", error)
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    )
  }
}

// Delete category
export async function DELETE(
  request: Request,
  { params }: { params: { categoryId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if category has courses
    const coursesCount = await db.course.count({
      where: { categoryId: params.categoryId },
    })

    if (coursesCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete category with courses. Please reassign courses first.",
        },
        { status: 400 }
      )
    }

    // Update children to have no parent
    await db.category.updateMany({
      where: { parentId: params.categoryId },
      data: { parentId: null },
    })

    await db.category.delete({
      where: { id: params.categoryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete category error:", error)
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    )
  }
}
