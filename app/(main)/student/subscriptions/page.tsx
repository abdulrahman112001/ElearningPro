import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Crown,
  History,
  Repeat,
  Users,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { SUBSCRIPTION_DAYS } from "@/lib/access"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  AvatarName,
  EmptyState,
  PageHeader,
  ScoreBar,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/shared"
import { SubscribeButton } from "@/components/student/subscribe-button"

export async function generateMetadata() {
  const t = await getTranslations("subscriptions")
  return { title: t("title") }
}

interface PageProps {
  searchParams: { success?: string }
}

const DAY_MS = 24 * 60 * 60 * 1000

export default async function StudentSubscriptionsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("subscriptions")
  const locale = await getLocale()
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
  })
  const numFmt = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")

  const records = await db.teacherSubscription.findMany({
    where: { studentId: session.user.id, status: { in: ["ACTIVE", "EXPIRED"] } },
    orderBy: { endsAt: "desc" },
    include: {
      instructor: {
        select: {
          id: true,
          name: true,
          image: true,
          headline: true,
          instructorProfile: { select: { subscriptionEnabled: true, monthlyPrice: true } },
          _count: { select: { courses: { where: { status: "PUBLISHED" } } } },
        },
      },
    },
  })

  // One row per teacher: renewals stack as separate records.
  const now = Date.now()
  type Row = {
    instructor: (typeof records)[number]["instructor"]
    active: boolean
    endsAt: Date | null
    startsAt: Date | null
    totalPaid: number
    currency: string
    periods: number
  }
  const byInstructor = new Map<string, Row>()
  for (const r of records) {
    const isActive = r.status === "ACTIVE" && !!r.endsAt && r.endsAt.getTime() > now
    const row = byInstructor.get(r.instructorId) ?? {
      instructor: r.instructor,
      active: false,
      endsAt: null,
      startsAt: null,
      totalPaid: 0,
      currency: r.currency,
      periods: 0,
    }
    row.active = row.active || isActive
    if (r.endsAt && (!row.endsAt || r.endsAt > row.endsAt)) row.endsAt = r.endsAt
    if (r.startsAt && (!row.startsAt || r.startsAt < row.startsAt)) row.startsAt = r.startsAt
    row.totalPaid += r.amount
    row.periods += 1
    byInstructor.set(r.instructorId, row)
  }
  const rows = Array.from(byInstructor.values())
  const active = rows
    .filter((r) => r.active)
    .sort((a, b) => (a.endsAt?.getTime() ?? 0) - (b.endsAt?.getTime() ?? 0))
  const expired = rows.filter((r) => !r.active)

  const unlockedCourses = active.reduce((acc, r) => acc + r.instructor._count.courses, 0)
  const nextRenewal = active[0]?.endsAt ?? null
  const daysLeft = (d: Date | null) => (d ? Math.max(0, Math.ceil((d.getTime() - now) / DAY_MS)) : 0)

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        icon={Repeat}
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild variant="outline">
            <Link href="/instructors">
              <Users aria-hidden="true" />
              {t("browseTeachers")}
            </Link>
          </Button>
        }
      />

      {searchParams.success === "1" && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold text-success">{t("successTitle")}</p>
            <p className="text-muted-foreground">{t("successDescription")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label={t("activeCount")}
          value={numFmt.format(active.length)}
          icon={Crown}
          tone="primary"
        />
        <StatCard
          label={t("unlockedCourses")}
          value={numFmt.format(unlockedCourses)}
          icon={BookOpen}
          tone="success"
        />
        <StatCard
          className="col-span-2 lg:col-span-1"
          label={t("nextExpiry")}
          value={nextRenewal ? dateFmt.format(nextRenewal) : "—"}
          icon={CalendarClock}
          tone="info"
          hint={nextRenewal ? t("daysLeft", { count: daysLeft(nextRenewal) }) : undefined}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Crown}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button asChild>
              <Link href="/instructors">{t("browseTeachers")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <SectionCard
            icon={Crown}
            title={t("activeTitle")}
            description={t("activeDescription")}
          >
            {active.length === 0 ? (
              <EmptyState
                variant="plain"
                size="sm"
                icon={Crown}
                title={t("noActive")}
                description={t("noActiveDescription")}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {active.map((row) => {
                  const left = daysLeft(row.endsAt)
                  const soon = left <= 5
                  const profile = row.instructor.instructorProfile
                  return (
                    <article
                      key={row.instructor.id}
                      className="flex flex-col gap-4 rounded-lg border bg-background/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <AvatarName
                          name={row.instructor.name}
                          image={row.instructor.image}
                          secondary={row.instructor.headline}
                          size="lg"
                        />
                        <StatusBadge
                          status={soon ? "PENDING" : "ACTIVE"}
                          label={soon ? t("expiringSoon") : undefined}
                        />
                      </div>

                      <ScoreBar
                        value={Math.min(left, SUBSCRIPTION_DAYS)}
                        max={SUBSCRIPTION_DAYS}
                        tone={soon ? "warning" : "success"}
                        label={t("endsOn", { date: row.endsAt ? dateFmt.format(row.endsAt) : "—" })}
                        valueLabel={t("daysLeft", { count: left })}
                      />

                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md bg-muted/50 p-2.5">
                          <dt className="text-xs text-muted-foreground">{t("coursesIncluded")}</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">
                            {numFmt.format(row.instructor._count.courses)}
                          </dd>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2.5">
                          <dt className="text-xs text-muted-foreground">{t("memberSince")}</dt>
                          <dd className="mt-0.5 font-semibold">
                            {row.startsAt ? dateFmt.format(row.startsAt) : "—"}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button asChild variant="outline" className="flex-1">
                          <Link href={`/instructors/${row.instructor.id}`}>
                            <BookOpen aria-hidden="true" />
                            {t("viewCourses")}
                          </Link>
                        </Button>
                        {profile?.subscriptionEnabled && (
                          <SubscribeButton
                            className="flex-1"
                            instructorId={row.instructor.id}
                            monthlyPrice={profile.monthlyPrice}
                            currency={row.currency}
                            subscribed
                          />
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {expired.length > 0 && (
            <SectionCard
              icon={History}
              title={t("expiredTitle")}
              description={t("expiredDescription")}
              contentClassName="p-0"
            >
              <ul className="divide-y">
                {expired.map((row) => {
                  const profile = row.instructor.instructorProfile
                  return (
                    <li
                      key={row.instructor.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <AvatarName
                        name={row.instructor.name}
                        image={row.instructor.image}
                        secondary={
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {t("expiredOn", { date: row.endsAt ? dateFmt.format(row.endsAt) : "—" })}
                          </span>
                        }
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status="EXPIRED" />
                        {profile?.subscriptionEnabled ? (
                          <SubscribeButton
                            size="sm"
                            instructorId={row.instructor.id}
                            monthlyPrice={profile.monthlyPrice}
                            currency={row.currency}
                            expired
                            label={t("resubscribeFor", {
                              price: formatPrice(profile.monthlyPrice, row.currency, locale),
                            })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("noLongerOffered")}</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
