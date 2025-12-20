import { Suspense } from "react"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { CoursesGrid } from "@/components/courses/courses-grid"
import { CoursesFilter } from "@/components/courses/courses-filter"
import { CoursesSidebar } from "@/components/courses/courses-sidebar"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface CoursesPageProps {
  searchParams: {
    category?: string
    level?: string
    price?: string
    rating?: string
    duration?: string
    search?: string
    sort?: string
    page?: string
  }
}

export async function generateMetadata() {
  const t = await getTranslations("courses")
  return {
    title: t("browseCourses"),
    description: "تصفح جميع الكورسات المتاحة",
  }
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const t = await getTranslations("courses")

  // Build filters
  const where: any = {
    status: "PUBLISHED",
  }

  if (searchParams.category) {
    where.categoryId = searchParams.category
  }

  if (searchParams.level) {
    where.level = searchParams.level
  }

  if (searchParams.price) {
    if (searchParams.price === "free") {
      where.price = 0
    } else if (searchParams.price === "paid") {
      where.price = { gt: 0 }
    }
  }

  if (searchParams.search) {
    where.OR = [
      { title: { contains: searchParams.search, mode: "insensitive" } },
      { description: { contains: searchParams.search, mode: "insensitive" } },
    ]
  }

  // Sort options
  let orderBy: any = { createdAt: "desc" }

  switch (searchParams.sort) {
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
    case "newest":
    default:
      orderBy = { createdAt: "desc" }
  }

  // Pagination
  const page = parseInt(searchParams.page || "1")
  const limit = 12
  const skip = (page - 1) * limit

  // Fetch courses and categories
  const [courses, totalCourses, categories] = await Promise.all([
    db.course.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        category: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
        chapters: {
          include: {
            lessons: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            reviews: true,
          },
        },
      },
    }),
    db.course.count({ where }),
    db.category.findMany({
      where: { parentId: null },
      include: {
        children: true,
        _count: {
          select: { courses: true },
        },
      },
      orderBy: { nameEn: "asc" },
    }),
  ])

  const totalPages = Math.ceil(totalCourses / limit)

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t("browseCourses")}
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            {t("browseDescription")}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <CoursesFilter totalCourses={totalCourses} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-72 shrink-0">
            <CoursesSidebar categories={categories} />
          </aside>

          {/* Courses Grid */}
          <main className="flex-1">
            <Suspense fallback={<LoadingSpinner />}>
              <CoursesGrid
                courses={courses}
                totalPages={totalPages}
                currentPage={page}
              />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}
