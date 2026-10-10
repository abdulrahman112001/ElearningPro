"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { CheckCircle2, Clock, Loader2, ScanLine, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { cairoFormatters } from "./time"

type Result =
  | { state: "loading" }
  | { state: "ok"; status: "PRESENT" | "LATE" | string; already: boolean; group?: string; startsAt?: string }
  | { state: "error"; code: string }

/** Sends the scanned token once and shows the outcome. */
export function CheckinClient({ token }: { token: string }) {
  const t = useTranslations("attendance.checkin")
  const locale = useLocale()
  const fmt = cairoFormatters(locale)
  const [result, setResult] = React.useState<Result>({ state: "loading" })
  const sent = React.useRef(false)

  React.useEffect(() => {
    if (sent.current) return
    sent.current = true
    if (!token) {
      setResult({ state: "error", code: "invalid_token" })
      return
    }
    fetch("/api/attendance/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (res.ok) setResult({ state: "ok", status: data.status, already: !!data.already, group: data.group, startsAt: data.startsAt })
        else setResult({ state: "error", code: data.code ?? (res.status === 429 ? "rate_limited" : "failed") })
      })
      .catch(() => setResult({ state: "error", code: "failed" }))
  }, [token])

  const errorKey = (code: string) =>
    ["expired_token", "invalid_token", "not_member", "rate_limited"].includes(code) ? code : "failed"

  return (
    <div
      data-testid="checkin-result"
      data-state={result.state}
      className="w-full max-w-md rounded-lg border bg-card p-6 text-center text-card-foreground shadow-soft"
    >
      {result.state === "loading" && (
        <div className="flex flex-col items-center gap-3 py-6" role="status">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
          <p className="font-medium">{t("checking")}</p>
        </div>
      )}
      {result.state === "ok" && (
        <div className="flex flex-col items-center gap-3 py-2" role="status">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full",
              result.status === "LATE" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
            )}
          >
            {result.status === "LATE" ? <Clock className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
          </div>
          <h1 className="text-xl font-bold">
            {result.already ? t("already") : result.status === "LATE" ? t("late") : t("present")}
          </h1>
          {result.group && (
            <p className="text-sm text-muted-foreground">
              {result.group}
              {result.startsAt ? ` · ${fmt.date.format(new Date(result.startsAt))} ${fmt.time.format(new Date(result.startsAt))}` : ""}
            </p>
          )}
          <Button asChild variant="outline" className="mt-2">
            <Link href="/student/attendance">{t("myAttendance")}</Link>
          </Button>
        </div>
      )}
      {result.state === "error" && (
        <div className="flex flex-col items-center gap-3 py-2" role="alert">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            {result.code === "expired_token" ? <ScanLine className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
          </div>
          <h1 className="text-xl font-bold">{t(`errors.${errorKey(result.code)}.title`)}</h1>
          <p className="text-sm text-muted-foreground">{t(`errors.${errorKey(result.code)}.description`)}</p>
        </div>
      )}
    </div>
  )
}
