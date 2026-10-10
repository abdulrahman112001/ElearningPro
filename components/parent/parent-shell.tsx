"use client"

import { useTranslations } from "next-intl"
import { FileText, HeartHandshake, LayoutDashboard, Settings } from "lucide-react"
import { DashboardShell, type DashboardNavSection } from "@/components/layout/dashboard-shell"

/** Parent dashboard chrome: sidebar (desktop) + tab bar (mobile). */
export function ParentShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("parent.shell")

  const sections: DashboardNavSection[] = [
    {
      id: "family",
      label: t("sections.family"),
      items: [
        { href: "/parent", label: t("overview"), icon: LayoutDashboard },
        { href: "/parent/reports", label: t("reports"), icon: FileText },
      ],
    },
    {
      id: "account",
      label: t("sections.account"),
      items: [{ href: "/parent/settings", label: t("settings"), icon: Settings }],
    },
  ]

  return (
    <DashboardShell title={t("title")} subtitle={t("subtitle")} icon={HeartHandshake} sections={sections}>
      {children}
    </DashboardShell>
  )
}
