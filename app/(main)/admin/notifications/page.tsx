import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NotificationsManager } from "@/components/admin/notifications-manager"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("notifications"),
  }
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string; search?: string }
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

  if (searchParams.type) {
    where.type = searchParams.type
  }

  if (searchParams.search) {
    where.OR = [
      { title: { contains: searchParams.search, mode: "insensitive" } },
      { message: { contains: searchParams.search, mode: "insensitive" } },
      {
        user: {
          is: {
            email: { contains: searchParams.search, mode: "insensitive" },
          },
        },
      },
    ]
  }

  const [notifications, total, stats, readCount] = await Promise.all([
    db.notification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.notification.count({ where }),
    db.notification.groupBy({
      by: ["type"],
      _count: true,
    }),
    db.notification.count({ where: { isRead: true } }),
  ])

  // Get user counts for sending notifications
  const [totalUsers, totalStudents, totalInstructors] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "INSTRUCTOR" } }),
  ])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("notifications")}</h1>
        <p className="text-muted-foreground mt-1">{t("manageNotifications")}</p>
      </div>

      <NotificationsManager
        notifications={notifications as any}
        stats={stats}
        userCounts={{
          total: totalUsers,
          students: totalStudents,
          instructors: totalInstructors,
        }}
        pagination={{
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }}
        readCount={readCount}
      />
    </div>
  )
}
