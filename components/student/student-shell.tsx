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
  ClipboardList,
  CalendarDays,
  BarChart3,
  CalendarCheck,
  Trophy,
  Medal,
  Building2,
  Megaphone,
  Wallet,
  UsersRound,
  Smartphone,
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
        { href: "/student/homework", label: n("homework"), icon: ClipboardList },
        { href: "/student/timetable", label: n("timetable"), icon: CalendarDays },
        { href: "/student/live", label: t("liveClasses"), icon: Video },
        { href: "/student/certificates", label: t("certificates"), icon: Award },
      ],
    },
    {
      id: "progress",
      label: n("sections.progress"),
      items: [
        { href: "/student/grades", label: n("grades"), icon: BarChart3 },
        { href: "/student/attendance", label: n("attendance"), icon: CalendarCheck },
        { href: "/student/achievements", label: n("achievements"), icon: Trophy },
        { href: "/student/leaderboard", label: n("leaderboard"), icon: Medal },
      ],
    },
    {
      id: "community",
      label: n("sections.community"),
      items: [
        { href: "/student/organizations", label: n("organizations"), icon: Building2 },
        { href: "/student/announcements", label: n("announcements"), icon: Megaphone },
      ],
    },
    {
      id: "shopping",
      label: n("sections.walletShopping"),
      items: [
        { href: "/student/wallet", label: n("wallet"), icon: Wallet },
        { href: "/student/wishlist", label: t("wishlist"), icon: Heart },
        { href: "/student/purchases", label: t("purchases"), icon: CreditCard },
      ],
    },
    {
      id: "account",
      label: n("sections.account"),
      items: [
        { href: "/student/profile", label: t("profile"), icon: User },
        { href: "/student/family", label: n("family"), icon: UsersRound },
        { href: "/student/devices", label: n("devices"), icon: Smartphone },
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
