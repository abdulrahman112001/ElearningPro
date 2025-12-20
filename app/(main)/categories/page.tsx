import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Layers } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function CategoriesPage() {
  const t = await getTranslations("categories")

  // Get all parent categories with their children and course counts
  const categories = await db.category.findMany({
    where: {
      parentId: null,
      isActive: true,
    },
    include: {
      children: {
        where: { isActive: true },
        include: {
          _count: {
            select: {
              courses: {
                where: { status: "PUBLISHED" },
              },
            },
          },
        },
      },
      _count: {
        select: {
          courses: {
            where: { status: "PUBLISHED" },
          },
        },
      },
    },
    orderBy: { position: "asc" },
  })

  // Calculate total courses for each parent category
  const categoriesWithTotals = categories.map((cat) => {
    const childCourses = cat.children.reduce(
      (sum, child) => sum + child._count.courses,
      0
    )
    return {
      ...cat,
      totalCourses: cat._count.courses + childCourses,
    }
  })

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categoriesWithTotals.map((category) => (
            <Link key={category.id} href={`/courses?category=${category.slug}`}>
              <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group overflow-hidden">
                {/* Category Image */}
                <div className="relative h-40 bg-gradient-to-br from-primary/20 to-primary/5">
                  {category.image ? (
                    <Image
                      src={category.image}
                      alt={category.nameAr || category.nameEn}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layers className="h-16 w-16 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 end-3">
                    <Badge className="bg-primary/90">
                      {category.totalCourses} {t("courses")}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                    {category.nameAr || category.nameEn}
                  </h3>

                  {category.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {category.description}
                    </p>
                  )}

                  {/* Subcategories */}
                  {category.children.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {category.children.slice(0, 3).map((sub) => (
                        <Badge
                          key={sub.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {sub.nameAr || sub.nameEn}
                        </Badge>
                      ))}
                      {category.children.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{category.children.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {categoriesWithTotals.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("noCategories")}</h3>
            <p className="text-muted-foreground">
              {t("noCategoriesDescription")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
