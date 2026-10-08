import { db } from "@/lib/db"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Clock,
  DollarSign,
  Eye,
  GraduationCap,
  MessagesSquare,
  UserPlus,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AvatarName,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/shared"
import { PendingReviewActions } from "@/components/admin/pending-review-actions"
import { ActivityList } from "@/components/admin/activity-feed"
import { ConversationRow } from "@/components/admin/conversations-list"
import { ROLE_TONES, adminUserHref } from "@/components/admin/activity-meta"
import { formatPrice } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("dashboard"),
  }
}

type ConversationRowSql = {
  user_a: string
  user_b: string
  message_count: number
  last_at: Date
  last_content: string | null
}

function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}>
        {label}
        <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
      </Link>
    </Button>
  )
}

export default async function AdminDashboard() {
  const t = await getTranslations("admin")
  const td = await getTranslations("adminDashboard")
  const tReview = await getTranslations("adminInstructorReview")
  const locale = await getLocale()
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-EG")
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-EG", { dateStyle: "medium" })
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Fetch admin stats
  const [
    totalUsers,
    totalInstructors,
    totalStudents,
    totalCourses,
    publishedCourses,
    pendingCourses,
    totalRevenue,
    monthlyRevenue,
    pendingWithdrawals,
    recentUsers,
    recentCourses,
    pendingInstructors,
    recentActivity,
    activity24h,
    conversationRows,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "INSTRUCTOR" } }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.course.count(),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.course.count({ where: { status: "PENDING_REVIEW" } }),
    db.purchase.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    db.purchase.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: {
          gte: new Date(new Date().setDate(1)), // First day of month
        },
      },
      _sum: { amount: true },
    }),
    db.withdrawal.count({ where: { status: "PENDING" } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    }),
    db.course.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        instructor: {
          select: { name: true },
        },
      },
    }),
    db.user.findMany({
      where: {
        role: "INSTRUCTOR",
        instructorProfile: {
          isApproved: false,
          applicationStatus: { in: ["PENDING", "APPROVED"] },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    }),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { id: true, name: true, email: true, image: true, role: true } } },
    }),
    db.activityLog.count({ where: { createdAt: { gte: since24h } } }),
    db.$queryRaw<ConversationRowSql[]>`
      SELECT LEAST("fromUserId", "toUserId") AS user_a,
             GREATEST("fromUserId", "toUserId") AS user_b,
             COUNT(*)::int AS message_count,
             MAX("createdAt") AS last_at,
             (ARRAY_AGG("content" ORDER BY "createdAt" DESC))[1] AS last_content
      FROM "Message"
      GROUP BY 1, 2
      ORDER BY last_at DESC
      LIMIT 5`,
  ])

  const conversationUserIds = Array.from(
    new Set(conversationRows.flatMap((r) => [r.user_a, r.user_b]))
  )
  const conversationUsers = conversationUserIds.length
    ? await db.user.findMany({
        where: { id: { in: conversationUserIds } },
        select: { id: true, name: true, email: true, image: true, role: true },
      })
    : []
  const usersById = new Map(conversationUsers.map((u) => [u.id, u]))
  const recentConversations = conversationRows
    .map((r) => ({
      participants: [usersById.get(r.user_a), usersById.get(r.user_b)].filter(
        (u): u is NonNullable<typeof u> => Boolean(u)
      ),
      messageCount: r.message_count,
      lastMessageAt: new Date(r.last_at).toISOString(),
      lastMessage: r.last_content?.slice(0, 160) ?? "",
    }))
    .filter((c) => c.participants.length === 2)

  const activityItems = recentActivity.map((a) => ({
    id: a.id,
    action: a.action,
    actorRole: a.actorRole,
    summary: a.summary,
    entityType: a.entityType,
    entityId: a.entityId,
    createdAt: a.createdAt.toISOString(),
    actor: a.actor,
  }))

  const pendingTotal = pendingCourses + pendingWithdrawals + pendingInstructors.length

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("dashboard")}
        description={t("dashboardSubtitle")}
        className="mb-0 sm:mb-0"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/conversations">
                <MessagesSquare className="h-4 w-4" aria-hidden="true" />
                {td("conversationsShortcut")}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/activity">
                <Activity className="h-4 w-4" aria-hidden="true" />
                {td("activityShortcut")}
              </Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("totalUsers")}
          value={nf.format(totalUsers)}
          icon={Users}
          tone="info"
          hint={td("usersBreakdown", {
            instructors: nf.format(totalInstructors),
            students: nf.format(totalStudents),
          })}
        />
        <StatCard
          label={t("totalCourses")}
          value={nf.format(totalCourses)}
          icon={BookOpen}
          tone="primary"
          hint={td("coursesBreakdown", {
            published: nf.format(publishedCourses),
            pending: nf.format(pendingCourses),
          })}
        />
        <StatCard
          label={t("totalRevenue")}
          value={formatPrice(totalRevenue._sum.amount || 0, "EGP", locale)}
          icon={DollarSign}
          tone="success"
          hint={td("revenueThisMonth", {
            amount: formatPrice(monthlyRevenue._sum.amount || 0, "EGP", locale),
          })}
        />
        <StatCard
          label={t("pendingActions")}
          value={nf.format(pendingTotal)}
          icon={Clock}
          tone="warning"
          hint={td("pendingBreakdown", {
            courses: nf.format(pendingCourses),
            withdrawals: nf.format(pendingWithdrawals),
            instructors: nf.format(pendingInstructors.length),
          })}
        />
      </div>

      {/* Oversight: activity + conversations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <SectionCard
          className="xl:col-span-3"
          title={td("recentActivity")}
          description={td("recentActivityDescription", { count: nf.format(activity24h) })}
          icon={Activity}
          action={<ViewAllLink href="/admin/activity" label={t("viewAll")} />}
          contentClassName="px-4 py-1 sm:px-6"
        >
          {activityItems.length === 0 ? (
            <EmptyState
              variant="plain"
              size="sm"
              icon={Activity}
              title={td("noActivity")}
              description={td("noActivityHint")}
            />
          ) : (
            <ActivityList items={activityItems} />
          )}
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          title={td("recentConversations")}
          description={td("recentConversationsDescription")}
          icon={MessagesSquare}
          action={<ViewAllLink href="/admin/conversations" label={t("viewAll")} />}
          contentClassName="p-0"
        >
          {recentConversations.length === 0 ? (
            <EmptyState
              variant="plain"
              size="sm"
              icon={MessagesSquare}
              title={td("noConversations")}
            />
          ) : (
            <ul className="divide-y">
              {recentConversations.map((c) => (
                <ConversationRow
                  key={c.participants.map((p) => p.id).join("-")}
                  conversation={c}
                  compact
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Courses */}
        <SectionCard
          title={t("pendingCourses")}
          icon={BookOpen}
          action={<ViewAllLink href="/admin/courses?status=PENDING" label={t("viewAll")} />}
          contentClassName="p-0"
        >
          {recentCourses.length === 0 ? (
            <EmptyState
              variant="plain"
              size="sm"
              icon={CheckCircle2}
              title={t("noPendingCourses")}
            />
          ) : (
            <ul className="divide-y">
              {recentCourses.map((course) => (
                <li
                  key={course.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {locale === "en"
                        ? course.titleEn || course.titleAr
                        : course.titleAr || course.titleEn}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {course.instructor.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <PendingReviewActions kind="course" id={course.id} />
                    <Button size="icon" variant="ghost" asChild>
                      <Link href={`/admin/courses/${course.id}`} aria-label={t("review")}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Pending Instructors */}
        <SectionCard
          title={t("pendingInstructors")}
          icon={GraduationCap}
          action={<ViewAllLink href="/admin/instructors?status=pending" label={t("viewAll")} />}
          contentClassName="p-0"
        >
          {pendingInstructors.length === 0 ? (
            <EmptyState
              variant="plain"
              size="sm"
              icon={CheckCircle2}
              title={t("noPendingInstructors")}
            />
          ) : (
            <ul className="divide-y">
              {pendingInstructors.map((instructor) => (
                <li
                  key={instructor.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
                >
                  <AvatarName
                    name={instructor.name}
                    image={instructor.image}
                    secondary={<span dir="ltr">{instructor.email}</span>}
                    className="flex-1"
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Instructors are reviewed with their full application (reject needs a reason). */}
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/admin/instructors?status=pending">{tReview("reviewApplication")}</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Recent Users */}
      <SectionCard
        title={t("recentUsers")}
        icon={UserPlus}
        action={<ViewAllLink href="/admin/users" label={t("viewAll")} />}
        contentClassName="p-0"
      >
        <ul className="divide-y">
          {recentUsers.map((user) => (
            <li key={user.id}>
              <Link
                href={adminUserHref(user)}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
              >
                <AvatarName
                  name={user.name}
                  image={user.image}
                  secondary={<span dir="ltr">{user.email}</span>}
                  className="flex-1"
                />
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <StatusBadge
                    status={user.role}
                    tone={ROLE_TONES[user.role] ?? "neutral"}
                    label={t(user.role.toLowerCase())}
                    dot={false}
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {dateFmt.format(user.createdAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
