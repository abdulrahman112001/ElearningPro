"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, EyeOff, Lock, MonitorSmartphone, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlaybackBlockedProps {
  code: string
  details: Record<string, any>
  onRetry?: () => void
}

/** Shown in place of the video when the play API refuses it. */
export function PlaybackBlocked({ code, details, onRetry }: PlaybackBlockedProps) {
  const t = useTranslations("videoProtection")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  let Icon = AlertTriangle
  let title = t("errorTitle")
  let description: React.ReactNode = t("errorDesc")
  let hint: React.ReactNode = null
  let action: React.ReactNode = onRetry ? (
    <Button variant="secondary" size="sm" className="gap-2" onClick={onRetry}>
      <RefreshCw className="h-4 w-4" />
      {t("retry")}
    </Button>
  ) : null

  if (code === "view_limit_reached") {
    Icon = EyeOff
    title = t("viewLimitTitle")
    description = t("viewLimitDesc", {
      used: nf.format(details.viewsUsed ?? 0),
      allowed: nf.format(details.viewsAllowed ?? 0),
    })
    hint = t("contactTeacher")
    action = null
  } else if (code === "device_limit") {
    Icon = MonitorSmartphone
    title = t("deviceLimitTitle")
    description = t("deviceLimitDesc", { count: details.maxDevices ?? 0 })
    hint = t("deviceLimitHint")
    action = (
      <Button asChild variant="secondary" size="sm">
        <Link href="/student/devices">{t("viewMyDevices")}</Link>
      </Button>
    )
  } else if (code === "not_enrolled" || code === "group_only" || code === "subscription_expired") {
    Icon = Lock
    title = t("noAccessTitle")
    description = t("noAccessDesc")
    action = null
  } else if (code === "no_video") {
    Icon = EyeOff
    title = t("noVideoTitle")
    description = null
    action = null
  }

  const devices: { id: string; label: string | null; lastSeenAt: string }[] =
    code === "device_limit" && Array.isArray(details.devices) ? details.devices : []

  return (
    <div
      className="flex min-h-[16rem] w-full items-center justify-center bg-black px-4 py-8 text-white aspect-video"
      role="alert"
      data-testid="playback-blocked"
      data-code={code}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-white/80">{description}</p>}
        {devices.length > 0 && (
          <ul className="w-full space-y-1 text-start text-xs text-white/70">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded bg-white/5 px-3 py-1.5">
                <span className="truncate" dir="ltr">
                  {d.label || t("unknownDevice")}
                </span>
                <span className="shrink-0">{dateFmt.format(new Date(d.lastSeenAt))}</span>
              </li>
            ))}
          </ul>
        )}
        {hint && <p className="text-xs text-amber-300">{hint}</p>}
        {action}
      </div>
    </div>
  )
}
