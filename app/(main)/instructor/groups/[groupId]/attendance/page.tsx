"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardCheck, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, ListSkeleton, PageHeader, SectionCard, StatusBadge } from "@/components/shared"
import { GroupTabs } from "@/components/attendance/group-tabs"
import { SessionAttendance } from "@/components/attendance/session-attendance"
import { cairoFormatters, fetchJson } from "@/components/attendance/time"

interface SessionRow {
  id: string
  title: string | null
  startsAt: string
  cancelled: boolean
  checkinActive: boolean
  counts: { PRESENT: number; LATE: number; ABSENT: number; EXCUSED: number }
}

function AttendanceInner() {
  const groupId = useParams<{ groupId: string }>()?.groupId ?? ""
  const search = useSearchParams()
  const router = useRouter()
  const sessionId = search?.get("session") ?? null
  const t = useTranslations("attendance.list")
  const tg = useTranslations("attendance")
  const locale = useLocale()
  const fmt = cairoFormatters(locale)
  const [group, setGroup] = React.useState<{ name: string } | null>(null)
  const [data, setData] = React.useState<{ sessions: SessionRow[]; memberCount: number } | null>(null)
  const [forbidden, setForbidden] = React.useState(false)

  const load = React.useCallback(() => {
    fetchJson<{ sessions: SessionRow[]; memberCount: number }>(`/api/instructor/groups/${groupId}/sessions?scope=all`)
      .then(setData)
      .catch(() => setForbidden(true))
  }, [groupId])

  React.useEffect(() => {
    if (!groupId) return
    fetchJson<{ name: string }>(`/api/instructor/groups/${groupId}`)
      .then(setGroup)
      .catch(() => setForbidden(true))
  }, [groupId])
  React.useEffect(() => {
    if (groupId && !sessionId) load()
  }, [groupId, sessionId, load])

  if (forbidden) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={tg("notFound")}
        action={
          <Button asChild variant="outline">
            <Link href="/instructor/groups">{tg("backToGroups")}</Link>
          </Button>
        }
      />
    )
  }

  const now = Date.now()
  const sessions = data?.sessions ?? []
  // Closest sessions first: today/upcoming (ascending) then the past (descending).
  const upcoming = sessions
    .filter((s) => new Date(s.startsAt).getTime() > now - 6 * 3600_000)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
  const past = sessions.filter((s) => new Date(s.startsAt).getTime() <= now - 6 * 3600_000)
  const Back = locale === "ar" ? ArrowRight : ArrowLeft

  const row = (s: SessionRow) => {
    const marked = s.counts.PRESENT + s.counts.LATE + s.counts.ABSENT + s.counts.EXCUSED
    return (
      <li key={s.id}>
        <Link
          href={`/instructor/groups/${groupId}/attendance?session=${s.id}`}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6"
        >
          <div className="min-w-0">
            <p className={s.cancelled ? "font-medium text-muted-foreground line-through" : "font-medium"}>
              {fmt.date.format(new Date(s.startsAt))} · {fmt.time.format(new Date(s.startsAt))}
            </p>
            {s.title && <p className="truncate text-xs text-muted-foreground">{s.title}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {s.cancelled ? (
              <StatusBadge status="CANCELLED" label={t("cancelled")} />
            ) : (
              <>
                {s.checkinActive && <StatusBadge status="LIVE" label={t("checkinLive")} dot />}
                <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
                  {t("presentCount", { count: s.counts.PRESENT + s.counts.LATE })}
                </span>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                  {t("absentCount", { count: s.counts.ABSENT })}
                </span>
                {marked === 0 && <span className="text-muted-foreground">{t("notTaken")}</span>}
              </>
            )}
          </div>
        </Link>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        title={t("title")}
        description={group ? t("subtitle", { name: group.name }) : undefined}
        breadcrumbs={[
          { label: tg("groupsCrumb"), href: "/instructor/groups" },
          { label: group?.name ?? "…", href: `/instructor/groups/${groupId}` },
          { label: t("title") },
        ]}
        actions={
          sessionId ? (
            <Button variant="outline" className="gap-2" onClick={() => router.push(`/instructor/groups/${groupId}/attendance`)}>
              <Back className="h-4 w-4" />
              {t("allSessions")}
            </Button>
          ) : (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/instructor/groups/${groupId}/schedule`}>
                <CalendarDays className="h-4 w-4" />
                {t("manageSchedule")}
              </Link>
            </Button>
          )
        }
      />
      <GroupTabs groupId={groupId} />

      {sessionId ? (
        <SessionAttendance key={sessionId} groupId={groupId} sessionId={sessionId} />
      ) : data === null ? (
        <ListSkeleton rows={5} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild>
              <Link href={`/instructor/groups/${groupId}/schedule`}>{t("manageSchedule")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title={t("upcoming")} description={t("membersCount", { count: data.memberCount })} contentClassName="p-0">
            {upcoming.length === 0 ? (
              <EmptyState variant="plain" size="sm" icon={CalendarDays} title={t("noUpcoming")} />
            ) : (
              <ul className="divide-y">{upcoming.slice(0, 20).map(row)}</ul>
            )}
          </SectionCard>
          <SectionCard title={t("past")} contentClassName="p-0">
            {past.length === 0 ? (
              <EmptyState variant="plain" size="sm" icon={ClipboardCheck} title={t("noPast")} />
            ) : (
              <ul className="divide-y">{past.map(row)}</ul>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}

export default function GroupAttendancePage() {
  return (
    <React.Suspense fallback={<ListSkeleton rows={5} />}>
      <AttendanceInner />
    </React.Suspense>
  )
}
