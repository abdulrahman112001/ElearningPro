import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { CalendarCheck2, CalendarClock, MapPin, Printer, Receipt, UsersRound, Video, Wallet } from "lucide-react"
import { auth } from "@/lib/auth"
import { loadStudentAttendance } from "@/lib/attendance"
import { Button } from "@/components/ui/button"
import { AvatarName, EmptyState, PageHeader, ScoreBar, SectionCard, StatCard } from "@/components/shared"
import { AttendanceBadge, FeeBadge } from "@/components/attendance/group-tabs"
import { PayWalletButton } from "@/components/fees/pay-wallet-button"

export async function generateMetadata() {
  const t = await getTranslations("attendance.student")
  return { title: t("title") }
}

export default async function StudentAttendancePage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("attendance.student")
  const tf = await getTranslations("fees")
  const locale = await getLocale()
  const l = locale === "ar" ? "ar-EG" : "en-US"
  const tz = "Africa/Cairo"
  const dateFmt = new Intl.DateTimeFormat(l, { timeZone: tz, weekday: "short", day: "numeric", month: "short" })
  const timeFmt = new Intl.DateTimeFormat(l, { timeZone: tz, hour: "numeric", minute: "2-digit" })
  const nf = new Intl.NumberFormat(l, { maximumFractionDigits: 2 })
  const money = (v: number) => tf("money", { amount: nf.format(v) })
  const monthName = (period: string) => {
    const [y, m] = period.split("-").map(Number)
    return new Intl.DateTimeFormat(l, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)))
  }

  const data = await loadStudentAttendance(session.user.id)
  const rates = data.groups.map((g) => g.rate).filter((r): r is number => r !== null)
  const overall = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  const nextSession = data.groups
    .flatMap((g) => g.upcoming.map((s) => ({ ...s, groupName: g.group.name })))
    .sort((a, b) => +a.startsAt - +b.startsAt)[0]

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarCheck2} title={t("title")} description={t("subtitle")} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("statGroups")} value={nf.format(data.groups.length)} icon={UsersRound} tone="info" />
        <StatCard label={t("statRate")} value={overall === null ? "—" : `${nf.format(overall)}%`} icon={CalendarCheck2} tone="success" />
        <StatCard
          label={t("statNext")}
          value={nextSession ? timeFmt.format(nextSession.startsAt) : "—"}
          hint={nextSession ? `${dateFmt.format(nextSession.startsAt)} · ${nextSession.groupName}` : undefined}
          icon={CalendarClock}
          tone="primary"
        />
        <StatCard
          label={t("statOutstanding")}
          value={money(data.outstanding)}
          hint={t("walletBalance", { amount: money(data.walletBalance) })}
          icon={Wallet}
          tone="warning"
        />
      </div>

      {data.groups.length === 0 ? (
        <EmptyState icon={UsersRound} title={t("noGroups")} description={t("noGroupsHint")} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.groups.map((g) => (
            <SectionCard
              key={g.group.id}
              icon={UsersRound}
              title={g.group.name}
            >
              <div className="space-y-5">
                <AvatarName name={g.group.instructor.name} image={g.group.instructor.image} size="sm" />
                <div>
                  {g.rate === null ? (
                    <p className="text-sm text-muted-foreground">{t("noRecords")}</p>
                  ) : (
                    <ScoreBar value={g.rate} label={t("rate")} thresholds={{ good: 85, fair: 70 }} />
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("tally", { present: g.tally.PRESENT, late: g.tally.LATE, absent: g.tally.ABSENT, excused: g.tally.EXCUSED })}
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">{t("upcoming")}</h3>
                  {g.upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {g.upcoming.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-medium">
                            {dateFmt.format(s.startsAt)} · {timeFmt.format(s.startsAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {s.mode === "ONLINE" ? (
                              <>
                                <Video className="h-3 w-3" aria-hidden="true" />
                                {t("online")}
                              </>
                            ) : s.location ? (
                              <>
                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                {s.location}
                              </>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">{t("recent")}</h3>
                  {g.recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("noRecent")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {g.recent.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            {dateFmt.format(s.startsAt)} · {timeFmt.format(s.startsAt)}
                          </span>
                          <AttendanceBadge status={s.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <SectionCard icon={Receipt} title={t("feesTitle")} description={t("feesHint")} contentClassName="p-0">
        {data.fees.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={Receipt} title={t("noFees")} />
        ) : (
          <ul className="divide-y">
            {data.fees.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="font-medium">
                    {f.group.name} · {monthName(f.period)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <FeeBadge status={f.status} />
                    {f.receiptNo && <span dir="ltr">{f.receiptNo}</span>}
                    {f.status === "WAIVED" && f.note && <span>{f.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{money(f.amount)}</span>
                  {f.status === "DUE" && (
                    <PayWalletButton feeId={f.id} amountLabel={money(f.amount)} groupName={f.group.name} />
                  )}
                  {f.status === "PAID" && (
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                      <Link href={`/student/attendance/receipt/${f.id}`}>
                        <Printer className="h-3.5 w-3.5" />
                        {tf("receipt")}
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
