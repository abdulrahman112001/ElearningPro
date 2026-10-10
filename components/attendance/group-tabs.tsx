"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarDays, ClipboardCheck, Users, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge, type Tone } from "@/components/shared"

/** Section tabs shared by the group pages (members, schedule, attendance, fees). */
export function GroupTabs({ groupId }: { groupId: string }) {
  const t = useTranslations("attendance.tabs")
  const pathname = usePathname() ?? ""
  const base = `/instructor/groups/${groupId}`
  const tabs = [
    { href: base, label: t("members"), icon: Users, active: pathname === base },
    { href: `${base}/schedule`, label: t("schedule"), icon: CalendarDays, active: pathname.startsWith(`${base}/schedule`) },
    { href: `${base}/attendance`, label: t("attendance"), icon: ClipboardCheck, active: pathname.startsWith(`${base}/attendance`) },
    { href: `${base}/fees`, label: t("fees"), icon: Wallet, active: pathname.startsWith(`${base}/fees`) },
  ]
  return (
    <nav aria-label={t("label")} className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                tab.active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const STATUS_TONE: Record<string, Tone> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "danger",
  EXCUSED: "info",
}

/** Attendance status pill (PRESENT / LATE / ABSENT / EXCUSED / not marked). */
export function AttendanceBadge({ status }: { status: string | null }) {
  const t = useTranslations("attendance.status")
  if (!status) return <StatusBadge status="NOT_STARTED" label={t("NONE")} tone="neutral" />
  return <StatusBadge status={status} label={t(status)} tone={STATUS_TONE[status] ?? "neutral"} dot />
}

const FEE_TONE: Record<string, Tone> = { DUE: "warning", PAID: "success", WAIVED: "neutral" }

export function FeeBadge({ status }: { status: string }) {
  const t = useTranslations("fees.status")
  return <StatusBadge status={status} label={t(status)} tone={FEE_TONE[status] ?? "neutral"} />
}
