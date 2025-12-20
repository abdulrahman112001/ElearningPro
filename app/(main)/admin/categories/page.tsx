import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { CategoriesManager } from "@/components/admin/categories-manager"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("categories"),
  }
}

export default async function AdminCategoriesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/")
  }

  const t = await getTranslations("admin")

  const rawCategories = await db.category.findMany({
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

  const categories = rawCategories.map((category) => ({
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

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("categories")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageCategories")}</p>
      </div>

      <CategoriesManager categories={categories} />
    </div>
  )
}
