import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { UsersTable } from "@/components/admin/users-table"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("users"),
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { page?: string; role?: string; search?: string }
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

  if (searchParams.role) {
    where.role = searchParams.role
  }

  if (searchParams.search) {
    where.OR = [
      { name: { contains: searchParams.search, mode: "insensitive" } },
      { email: { contains: searchParams.search, mode: "insensitive" } },
    ]
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isBlocked: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            courses: true,
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("users")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageUsers")}</p>
      </div>

      <UsersTable
        users={users}
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
