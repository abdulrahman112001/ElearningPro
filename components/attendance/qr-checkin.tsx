"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, QrCode, Square, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AvatarName } from "@/components/shared"
import { AttendanceBadge } from "./group-tabs"
import { fetchJson, intlLocale } from "./time"

interface CheckinState {
  active: boolean
  url: string | null
  svg: string | null
  expiresAt: string | null
  checkedIn: number
  late: number
  members: number
  recent: { status: string; markedAt: string; student: { id: string; name: string | null; image: string | null } }[]
}

const POLL_MS = 3000

/**
 * Teacher's QR check-in screen. The server rotates the token about every 30s
 * while this page polls; the counter updates live as students scan.
 */
export function QrCheckin({
  groupId,
  sessionId,
  initiallyActive,
  disabled,
  onChange,
}: {
  groupId: string
  sessionId: string
  initiallyActive: boolean
  disabled?: boolean
  onChange: () => void
}) {
  const t = useTranslations("attendance.qr")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(intlLocale(locale))
  const [state, setState] = React.useState<CheckinState | null>(null)
  const [busy, setBusy] = React.useState(false)
  const base = `/api/instructor/groups/${groupId}/sessions/${sessionId}/checkin`
  const lastCount = React.useRef<number | null>(null)

  const poll = React.useCallback(async () => {
    try {
      const s = await fetchJson<CheckinState>(base)
      setState(s)
      if (lastCount.current !== null && s.checkedIn !== lastCount.current) onChange()
      lastCount.current = s.checkedIn
    } catch {
      /* keep the last state; the next poll retries */
    }
  }, [base, onChange])

  React.useEffect(() => {
    if (initiallyActive) poll()
  }, [initiallyActive, poll])

  const active = !!state?.active
  React.useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") poll()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [active, poll])

  const start = async () => {
    setBusy(true)
    try {
      const s = await fetchJson<CheckinState>(base, { method: "POST" })
      lastCount.current = s.checkedIn
      setState(s)
    } catch {
      toast.error(t("startFailed"))
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    setBusy(true)
    try {
      await fetchJson(base, { method: "DELETE" })
      setState((s) => (s ? { ...s, active: false, svg: null, url: null } : s))
      onChange()
    } catch {
      toast.error(t("stopFailed"))
    } finally {
      setBusy(false)
    }
  }

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <QrCode className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{t("title")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("hint")}</p>
        </div>
        <Button onClick={start} disabled={busy || disabled} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          {t("start")}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-white p-4 text-black">
        <div
          role="img"
          aria-label={t("qrAlt")}
          className="aspect-square w-full max-w-[min(70vh,28rem)] [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: state!.svg ?? "" }}
        />
        <p className="text-center text-sm font-medium">{t("scanHint")}</p>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 text-center" aria-live="polite">
          <UserCheck className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
          <p className="mt-2 text-4xl font-bold tabular-nums">
            {nf.format(state!.checkedIn)}
            <span className="text-lg font-medium text-muted-foreground"> / {nf.format(state!.members)}</span>
          </p>
          <p className="text-sm text-muted-foreground">{t("checkedIn")}</p>
          {state!.late > 0 && <p className="mt-1 text-xs text-warning">{t("lateCount", { count: state!.late })}</p>}
        </div>
        <Button variant="outline" onClick={stop} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          {t("stop")}
        </Button>
        {state!.recent.length > 0 && (
          <ul className="space-y-2">
            {state!.recent.map((r) => (
              <li key={r.student.id} className="flex items-center justify-between gap-2">
                <AvatarName name={r.student.name} image={r.student.image} size="sm" className="min-w-0" />
                <AttendanceBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
