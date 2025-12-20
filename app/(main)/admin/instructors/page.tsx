import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { InstructorsTable } from "@/components/admin/instructors-table"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("instructors"),
  }
}

export default async function AdminInstructorsPage({
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

  const where: any = {
    role: "INSTRUCTOR",
  }

  if (searchParams.status === "pending") {
    where.instructorProfile = { is: { isApproved: false } }
  } else if (searchParams.status === "approved") {
    where.instructorProfile = { is: { isApproved: true } }
  }

  if (searchParams.search) {
    where.OR = [
      { name: { contains: searchParams.search, mode: "insensitive" } },
      { email: { contains: searchParams.search, mode: "insensitive" } },
    ]
  }

  if (searchParams.search) {
    where.OR = [
      { name: { contains: searchParams.search, mode: "insensitive" } },
      { email: { contains: searchParams.search, mode: "insensitive" } },
    ]
  }

  const [instructors, total, pendingCount] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        headline: true,
        bio: true,
        isBlocked: true,
        createdAt: true,
        instructorProfile: {
          select: {
            isApproved: true,
            approvedAt: true,
            commissionRate: true,
            totalEarnings: true,
            pendingEarnings: true,
          },
        },
        _count: {
          select: {
            courses: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
    db.user.count({
      where: {
        role: "INSTRUCTOR",
        instructorProfile: { is: { isApproved: false } },
      },
    }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("instructors")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageInstructors")}</p>
      </div>

      <InstructorsTable
        instructors={instructors as any}
        pendingCount={pendingCount}
        pagination={{
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }}
      />
    </div>
  )
}
