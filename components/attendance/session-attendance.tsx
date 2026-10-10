"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { CheckCheck, ClipboardCheck, Loader2, Lock, MapPin, Users, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AvatarName, EmptyState, ListSkeleton, SectionCard, StatCard, StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"
import { AttendanceBadge } from "./group-tabs"
import { QrCheckin } from "./qr-checkin"
import { cairoFormatters, fetchJson } from "./time"

type Status = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED"
const STATUSES: Status[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"]
const ACTIVE_STYLE: Record<Status, string> = {
  PRESENT: "border-success bg-success text-success-foreground hover:bg-success/90",
  LATE: "border-warning bg-warning text-warning-foreground hover:bg-warning/90",
  ABSENT: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
  EXCUSED: "border-info bg-info text-info-foreground hover:bg-info/90",
}

interface RosterRow {
  student: { id: string; name: string | null; email: string | null; image: string | null }
  member: boolean
  status: Status | null
  method: string | null
}

interface Detail {
  session: {
    id: string
    title: string | null
    startsAt: string
    endsAt: string | null
    mode: string
    location: string | null
    cancelled: boolean
    checkinActive: boolean
  }
  roster: RosterRow[]
}

export function SessionAttendance({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const t = useTranslations("attendance.session")
  const ts = useTranslations("attendance.status")
  const tc = useTranslations("common")
  const locale = useLocale()
  const fmt = cairoFormatters(locale)
  const [data, setData] = React.useState<Detail | null>(null)
  const [missing, setMissing] = React.useState(false)
  const [pending, setPending] = React.useState<string | null>(null)
  const [bulk, setBulk] = React.useState(false)
  const [confirmClose, setConfirmClose] = React.useState(false)
  const [closing, setClosing] = React.useState(false)
  const base = `/api/instructor/groups/${groupId}/sessions/${sessionId}`

  const load = React.useCallback(async () => {
    try {
      setData(await fetchJson<Detail>(base))
    } catch {
      setMissing(true)
    }
  }, [base])

  React.useEffect(() => {
    setData(null)
    setMissing(false)
    load()
  }, [load])

  const mark = async (studentId: string, status: Status) => {
    setPending(studentId)
    const previous = data
    setData((d) =>
      d ? { ...d, roster: d.roster.map((r) => (r.student.id === studentId ? { ...r, status, method: "MANUAL" } : r)) } : d
    )
    try {
      await fetchJson(`${base}/attendance`, { method: "PUT", json: { records: [{ studentId, status }] } })
    } catch {
      setData(previous)
      toast.error(t("markFailed"))
    } finally {
      setPending(null)
    }
  }

  const markAll = async () => {
    setBulk(true)
    try {
      await fetchJson(`${base}/attendance`, { method: "PUT", json: { all: "PRESENT" } })
      toast.success(t("allMarked"))
      await load()
    } catch {
      toast.error(t("markFailed"))
    } finally {
      setBulk(false)
    }
  }

  const close = async () => {
    setClosing(true)
    try {
      const res = await fetchJson<{ markedAbsent: number; notified: number }>(`${base}/close`, { method: "POST" })
      toast.success(t("closed", { absent: res.markedAbsent, notified: res.notified }))
      setConfirmClose(false)
      await load()
    } catch {
      toast.error(t("closeFailed"))
    } finally {
      setClosing(false)
    }
  }

  if (missing) return <EmptyState icon={ClipboardCheck} title={t("notFound")} />
  if (!data) return <ListSkeleton rows={5} />

  const { session, roster } = data
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, NONE: 0 }
  for (const r of roster) counts[r.status ?? "NONE"]++
  const nf = fmt.number
  const start = new Date(session.startsAt)

  return (
    <div className="space-y-6">
      <SectionCard
        icon={ClipboardCheck}
        title={session.title || fmt.dateLong.format(start)}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {session.title ? `${fmt.date.format(start)} · ` : ""}
              {fmt.time.format(start)}
              {session.endsAt ? ` – ${fmt.time.format(new Date(session.endsAt))}` : ""}
            </span>
            {session.mode === "ONLINE" ? (
              <span className="inline-flex items-center gap-1">
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                {t("online")}
              </span>
            ) : (
              session.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {session.location}
                </span>
              )
            )}
          </span>
        }
        action={session.cancelled ? <StatusBadge status="CANCELLED" label={t("cancelled")} /> : undefined}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={ts("PRESENT")} value={nf.format(counts.PRESENT)} tone="success" />
          <StatCard label={ts("LATE")} value={nf.format(counts.LATE)} tone="warning" />
          <StatCard label={ts("ABSENT")} value={nf.format(counts.ABSENT)} tone="danger" />
          <StatCard label={ts("NONE")} value={nf.format(counts.NONE)} tone="info" />
        </div>
      </SectionCard>

      {!session.cancelled && (
        <SectionCard title={t("qrTitle")} description={t("qrHint")}>
          <QrCheckin groupId={groupId} sessionId={sessionId} initiallyActive={session.checkinActive} onChange={load} />
        </SectionCard>
      )}

      <SectionCard
        icon={Users}
        title={t("rosterTitle")}
        description={t("rosterCount", { count: roster.length })}
        contentClassName="p-0"
        action={
          !session.cancelled && roster.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={markAll} disabled={bulk} className="gap-2">
                {bulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                {t("markAllPresent")}
              </Button>
              <Button size="sm" onClick={() => setConfirmClose(true)} className="gap-2">
                <Lock className="h-4 w-4" />
                {t("close")}
              </Button>
            </div>
          ) : undefined
        }
      >
        {roster.length === 0 ? (
          <EmptyState variant="plain" icon={Users} title={t("noMembers")} />
        ) : (
          <ul className="divide-y">
            {roster.map((r) => (
              <li key={r.student.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarName
                    name={r.student.name}
                    image={r.student.image}
                    size="sm"
                    secondary={
                      r.method === "QR" ? t("viaQr") : !r.member ? t("formerMember") : undefined
                    }
                    className="min-w-0"
                  />
                  <span className="sm:hidden">
                    <AttendanceBadge status={r.status} />
                  </span>
                </div>
                <div role="group" aria-label={t("statusFor", { name: r.student.name ?? "" })} className="grid grid-cols-4 gap-1 sm:flex">
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-pressed={r.status === s}
                      disabled={session.cancelled || pending === r.student.id || !r.member}
                      onClick={() => r.status !== s && mark(r.student.id, s)}
                      className={cn("h-9 px-2 text-xs sm:px-3", r.status === s && ACTIVE_STYLE[s])}
                    >
                      {ts(s)}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <AlertDialog open={confirmClose} onOpenChange={(o) => !closing && setConfirmClose(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("closeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("closeDescription", { count: counts.NONE })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                close()
              }}
              disabled={closing}
            >
              {closing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
