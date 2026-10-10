"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarDays, CalendarRange, FileText, LayoutDashboard, Megaphone, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

/** Section tabs of /org/[orgId]/school. Scrolls inside itself on phones. */
export function SchoolTabs({ orgId }: { orgId: string }) {
  const t = useTranslations("school")
  const pathname = usePathname()
  const base = `/org/${orgId}/school`
  const tabs = [
    { href: base, label: t("tabs.overview"), icon: LayoutDashboard, exact: true },
    { href: `${base}/terms`, label: t("tabs.terms"), icon: CalendarRange },
    { href: `${base}/subjects`, label: t("tabs.subjects"), icon: BookOpen },
    { href: `${base}/timetable`, label: t("tabs.timetable"), icon: CalendarDays },
    { href: `${base}/announcements`, label: t("tabs.announcements"), icon: Megaphone },
    { href: `${base}/report-cards`, label: t("tabs.reportCards"), icon: FileText },
  ]
  return (
    <nav aria-label={t("tabs.label")} className="mb-6 print:hidden">
      <ul className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 shadow-soft [scrollbar-width:none]">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
