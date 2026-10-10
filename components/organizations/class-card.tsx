"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { CalendarCheck, Clock, MapPin, Users, Wallet } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export interface ClassCardData {
  id: string
  name: string
  mode: string
  location: string | null
  monthlyFee: number
  capacity: number | null
  members: number
  teacher: string | null
  grade: string | null
  slots: { dayOfWeek: number; startTime: string }[]
}

/** Short "Sat 17:00 · Tue 18:30" schedule line, or null when no slots exist. */
export function scheduleSummary(slots: { dayOfWeek: number; startTime: string }[], locale: string) {
  if (!slots.length) return null
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { weekday: "short", timeZone: "UTC" })
  // 2023-01-01 was a Sunday (dayOfWeek 0).
  return slots
    .map((s) => `${fmt.format(new Date(Date.UTC(2023, 0, 1 + s.dayOfWeek)))} ${s.startTime}`)
    .join(" · ")
}

export function ClassCard({
  group,
  locale,
  showManageLinks,
  children,
}: {
  group: ClassCardData
  locale: string
  showManageLinks?: boolean
  children?: React.ReactNode
}) {
  const t = useTranslations("organizations")
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const schedule = scheduleSummary(group.slots, locale)

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{group.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[group.grade, group.teacher].filter(Boolean).join(" · ") || " "}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">{t(`modes.${group.mode}`)}</Badge>
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          {group.capacity
            ? t("classes.seats", { count: group.members, capacity: nf.format(group.capacity) })
            : t("classes.studentsCount", { count: group.members })}
        </li>
        <li className="flex items-center gap-2">
          <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
          {group.monthlyFee > 0
            ? t("classes.perMonth", { fee: formatPrice(group.monthlyFee, "EGP", locale) })
            : t("classes.free")}
        </li>
        {group.location && (
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{group.location}</span>
          </li>
        )}
        {schedule && (
          <li className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{schedule}</span>
          </li>
        )}
      </ul>
      {showManageLinks && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href={`/instructor/groups/${group.id}/attendance`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted">
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("classes.attendance")}
          </Link>
          <Link href={`/instructor/groups/${group.id}/fees`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            {t("classes.fees")}
          </Link>
        </div>
      )}
      {children}
    </div>
  )
}
