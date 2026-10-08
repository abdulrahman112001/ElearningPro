"use client"

import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  GraduationCap,
  Repeat,
  Award,
  Video,
  Heart,
  CreditCard,
  User,
  Settings,
  BookOpenCheck,
} from "lucide-react"
import { DashboardShell, type DashboardNavSection } from "@/components/layout/dashboard-shell"

/** Student dashboard chrome: sectioned sidebar (desktop) + tab bar (mobile). */
export function StudentShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("student")
  const n = useTranslations("nav.dashboard")

  const sections: DashboardNavSection[] = [
    {
      id: "learning",
      label: n("sections.learning"),
      items: [
        { href: "/student", label: t("overview"), icon: LayoutDashboard, exact: true },
        { href: "/student/courses", label: t("myCourses"), icon: GraduationCap },
        { href: "/student/subscriptions", label: n("subscriptions"), icon: Repeat },
        { href: "/student/live", label: t("liveClasses"), icon: Video },
        { href: "/student/certificates", label: t("certificates"), icon: Award },
      ],
    },
    {
      id: "shopping",
      label: n("sections.shopping"),
      items: [
        { href: "/student/wishlist", label: t("wishlist"), icon: Heart },
        { href: "/student/purchases", label: t("purchases"), icon: CreditCard },
      ],
    },
    {
      id: "account",
      label: n("sections.account"),
      items: [
        { href: "/student/profile", label: t("profile"), icon: User },
        { href: "/student/settings", label: t("settings"), icon: Settings },
      ],
    },
  ]

  return (
    <DashboardShell
      title={n("studentPanel")}
      subtitle={n("studentSubtitle")}
      icon={BookOpenCheck}
      sections={sections}
    >
      {children}
    </DashboardShell>
  )
}
