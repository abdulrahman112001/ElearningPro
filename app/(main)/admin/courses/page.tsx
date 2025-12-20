import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { CoursesTable } from "@/components/admin/courses-table"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("courses"),
  }
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; search?: string }
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/")
  }

  const t = await getTranslations("admin")
  const page = parseInt(searchParams.page || "1")
  const limit = 20

  const where: any = {}

  if (searchParams.status) {
    where.status = searchParams.status
  }

  if (searchParams.search) {
    where.OR = [
      { titleEn: { contains: searchParams.search, mode: "insensitive" } },
      { titleAr: { contains: searchParams.search, mode: "insensitive" } },
    ]
  }

  const [courses, total] = await Promise.all([
    db.course.findMany({
      where,
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
        _count: {
          select: {
            chapters: true,
            enrollments: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.course.count({ where }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("courses")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageCourses")}</p>
      </div>

      <CoursesTable
        courses={courses}
        pagination={{
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }}
      />
    </div>
  )
}
