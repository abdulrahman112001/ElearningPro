import { Suspense } from "react"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { CoursesGrid } from "@/components/courses/courses-grid"
import { CoursesFilter } from "@/components/courses/courses-filter"
import { CoursesSidebar } from "@/components/courses/courses-sidebar"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface CoursesPageProps {
  searchParams: {
    category?: string
    grade?: string
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

  // ?grade=<gradeLevelId>: courses for one academic grade
  if (searchParams.grade) {
    where.gradeLevelId = searchParams.grade
  }

  if (
    searchParams.level &&
    ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"].includes(searchParams.level)
  ) {
    where.level = searchParams.level
  }

  const minRating = parseFloat(searchParams.rating || "")
  if (!Number.isNaN(minRating) && minRating > 0) {
    where.averageRating = { gte: minRating }
  }

  // totalDuration is stored in minutes
  if (searchParams.duration === "short") {
    where.totalDuration = { lte: 120 }
  } else if (searchParams.duration === "medium") {
    where.totalDuration = { gt: 120, lte: 600 }
  } else if (searchParams.duration === "long") {
    where.totalDuration = { gt: 600 }
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
      { titleEn: { contains: searchParams.search, mode: "insensitive" } },
      { titleAr: { contains: searchParams.search, mode: "insensitive" } },
      { descriptionEn: { contains: searchParams.search, mode: "insensitive" } },
      { descriptionAr: { contains: searchParams.search, mode: "insensitive" } },
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
  const page = Math.max(1, parseInt(searchParams.page || "1") || 1)
  const limit = 12
  const skip = (page - 1) * limit

  // The signed-in student's own grade, highlighted in the grade selector
  const session = await auth()
  const me = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { gradeLevelId: true },
      })
    : null

  // Fetch courses, categories and grades
  const [courses, totalCourses, categories, grades] = await Promise.all([
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
    db.gradeLevel.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { nameEn: "asc" }],
      select: { id: true, nameAr: true, nameEn: true },
    }),
  ])

  const totalPages = Math.ceil(totalCourses / limit)

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-mesh-brand relative overflow-hidden py-12 md:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/30 via-background/90 to-muted/30" />
        <div className="container mx-auto px-4">
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight md:text-4xl">
            <span className="gradient-text">{t("browseCourses")}</span>
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {t("browseDescription")}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <CoursesFilter
        totalCourses={totalCourses}
        grades={grades}
        myGradeId={me?.gradeLevelId ?? null}
      />

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
