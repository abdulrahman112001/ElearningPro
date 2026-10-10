import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Banknote, CalendarClock, CalendarDays, ClipboardCheck, MapPin, QrCode, UsersRound, Video, Wallet } from "lucide-react"
import { auth } from "@/lib/auth"
import { loadTeacherOverview } from "@/lib/attendance"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/shared"

export async function generateMetadata() {
  const t = await getTranslations("attendance.overview")
  return { title: t("title") }
}

export default async function InstructorAttendanceOverviewPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("attendance.overview")
  const tf = await getTranslations("fees")
  const locale = await getLocale()
  const l = locale === "ar" ? "ar-EG" : "en-US"
  const tz = "Africa/Cairo"
  const timeFmt = new Intl.DateTimeFormat(l, { timeZone: tz, hour: "numeric", minute: "2-digit" })
  const dateFmt = new Intl.DateTimeFormat(l, { timeZone: tz, weekday: "short", day: "numeric", month: "short" })
  const todayFmt = new Intl.DateTimeFormat(l, { timeZone: tz, dateStyle: "full" })
  const nf = new Intl.NumberFormat(l, { maximumFractionDigits: 2 })
  const money = (v: number) => tf("money", { amount: nf.format(v) })

  const data = await loadTeacherOverview(session.user)
  const now = Date.now()
  const withDues = data.groups.filter((g) => g.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardCheck} title={t("title")} description={todayFmt.format(new Date())} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("statToday")} value={nf.format(data.today.filter((s) => !s.cancelled).length)} icon={CalendarClock} tone="primary" />
        <StatCard label={t("statGroups")} value={nf.format(data.groups.length)} icon={UsersRound} tone="info" />
        <StatCard label={t("statCollected")} value={money(data.fees.collectedThisPeriod)} icon={Banknote} tone="success" hint={t("thisMonth")} />
        <StatCard
          label={t("statOutstanding")}
          value={money(data.fees.outstanding)}
          icon={Wallet}
          tone="warning"
          hint={t("dueFees", { count: data.fees.dueCount })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard className="lg:col-span-3" icon={CalendarClock} title={t("todayTitle")} contentClassName="p-0">
          {data.today.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={CalendarDays}
              title={t("noToday")}
              description={data.upcoming.length ? undefined : t("noTodayHint")}
            />
          ) : (
            <ul className="divide-y">
              {data.today.map((s) => {
                const present = s.counts.PRESENT + s.counts.LATE
                const started = +s.startsAt <= now
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                      <p className={s.cancelled ? "font-semibold text-muted-foreground line-through" : "font-semibold"}>
                        {timeFmt.format(s.startsAt)} · {s.group.name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {s.title && <span>{s.title}</span>}
                        {s.mode === "ONLINE" ? (
                          <span className="inline-flex items-center gap-1">
                            <Video className="h-3 w-3" aria-hidden="true" />
                            {t("online")}
                          </span>
                        ) : (
                          s.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {s.location}
                            </span>
                          )
                        )}
                        {!s.cancelled && <span>{t("presentOf", { present, total: s.group.members })}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.cancelled ? (
                        <StatusBadge status="CANCELLED" label={t("cancelled")} />
                      ) : (
                        <>
                          {s.checkinActive && <StatusBadge status="LIVE" label={t("checkinLive")} dot />}
                          <Button asChild size="sm" variant={started ? "default" : "outline"} className="h-8 gap-1">
                            <Link href={`/instructor/groups/${s.groupId}/attendance?session=${s.id}`}>
                              <QrCode className="h-3.5 w-3.5" />
                              {t("takeAttendance")}
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {data.upcoming.length > 0 && (
            <div className="border-t px-4 py-3 sm:px-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("next")}</p>
              <ul className="space-y-1.5">
                {data.upcoming.map((s) => (
                  <li key={s.id} className="flex flex-wrap justify-between gap-2 text-sm">
                    <Link href={`/instructor/groups/${s.groupId}/attendance?session=${s.id}`} className="hover:text-primary hover:underline">
                      {dateFmt.format(s.startsAt)} · {timeFmt.format(s.startsAt)}
                    </Link>
                    <span className="text-muted-foreground">{s.group.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard className="lg:col-span-2" icon={Wallet} title={t("feesTitle")} contentClassName="p-0">
          {withDues.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={Wallet} title={t("noDues")} />
          ) : (
            <ul className="divide-y">
              {withDues.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/instructor/groups/${g.id}/fees`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{t("dueFees", { count: g.dueCount })}</p>
                    </div>
                    <span className="font-semibold tabular-nums text-warning">{money(g.outstanding)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {data.groups.length > 0 && (
        <SectionCard icon={UsersRound} title={t("groupsTitle")} contentClassName="p-0">
          <ul className="divide-y">
            {data.groups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
                <Link href={`/instructor/groups/${g.id}`} className="min-w-0 truncate font-medium hover:text-primary hover:underline">
                  {g.name}
                </Link>
                <div className="flex flex-wrap gap-1">
                  <Button asChild size="sm" variant="ghost" className="h-8">
                    <Link href={`/instructor/groups/${g.id}/schedule`}>{t("schedule")}</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="h-8">
                    <Link href={`/instructor/groups/${g.id}/attendance`}>{t("attendance")}</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="h-8">
                    <Link href={`/instructor/groups/${g.id}/fees`}>{t("fees")}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}
