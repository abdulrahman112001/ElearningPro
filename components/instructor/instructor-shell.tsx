"use client"

import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Video,
  Users,
  UsersRound,
  Trophy,
  MessageCircleQuestion,
  DollarSign,
  BarChart3,
  Settings,
  MessageSquare,
  Star,
  Wallet,
  BadgeDollarSign,
  Presentation,
  Sparkles,
  ClipboardList,
  Library,
  ClipboardCheck,
  CalendarDays,
  ShieldCheck,
  CalendarCheck,
  Sheet,
  Medal,
  Ticket,
  Building2,
} from "lucide-react"
import { DashboardShell, type DashboardNavSection } from "@/components/layout/dashboard-shell"

/** Teacher dashboard chrome: sectioned sidebar (desktop) + tab bar (mobile). */
export function InstructorShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("instructor")
  const n = useTranslations("nav.dashboard")

  const sections: DashboardNavSection[] = [
    {
      id: "general",
      items: [
        { href: "/instructor", label: t("overview"), icon: LayoutDashboard, exact: true },
        { href: "/instructor/analytics", label: t("analytics"), icon: BarChart3 },
        { href: "/instructor/ai-insights", label: n("aiInsights"), icon: Sparkles },
      ],
    },
    {
      id: "teaching",
      label: n("sections.teaching"),
      items: [
        { href: "/instructor/courses", label: t("myCourses"), icon: BookOpen },
        { href: "/instructor/courses/create", label: t("createCourse"), icon: PlusCircle },
        { href: "/instructor/live", label: t("liveClasses"), icon: Video },
        { href: "/instructor/assignments", label: n("assignments"), icon: ClipboardList },
        { href: "/instructor/question-bank", label: n("questionBank"), icon: Library },
        { href: "/instructor/grading", label: n("grading"), icon: ClipboardCheck },
        { href: "/instructor/timetable", label: n("timetable"), icon: CalendarDays },
        { href: "/instructor/video-protection", label: n("videoProtection"), icon: ShieldCheck },
      ],
    },
    {
      id: "students",
      label: n("sections.students"),
      items: [
        { href: "/instructor/students", label: t("students"), icon: Users },
        { href: "/instructor/groups", label: n("groups"), icon: UsersRound },
        { href: "/instructor/attendance", label: n("attendance"), icon: CalendarCheck },
        { href: "/instructor/results", label: n("results"), icon: Trophy },
        { href: "/instructor/gradebook", label: n("gradebook"), icon: Sheet },
        { href: "/instructor/leaderboard", label: n("leaderboard"), icon: Medal },
        { href: "/instructor/questions", label: n("questions"), icon: MessageCircleQuestion },
        { href: "/instructor/reviews", label: t("reviews"), icon: Star },
        { href: "/instructor/messages", label: t("messages"), icon: MessageSquare },
      ],
    },
    {
      id: "money",
      label: n("sections.money"),
      items: [
        { href: "/instructor/subscribers", label: n("subscribers"), icon: BadgeDollarSign },
        { href: "/instructor/codes", label: n("codes"), icon: Ticket },
        { href: "/instructor/earnings", label: t("earnings"), icon: DollarSign },
        { href: "/instructor/withdrawals", label: t("withdrawals"), icon: Wallet },
      ],
    },
    {
      id: "account",
      label: n("sections.account"),
      items: [
        { href: "/org", label: n("organizations"), icon: Building2 },
        { href: "/instructor/settings", label: t("settings"), icon: Settings },
      ],
    },
  ]

  return (
    <DashboardShell
      title={t("instructorPanel")}
      subtitle={n("instructorSubtitle")}
      icon={Presentation}
      sections={sections}
    >
      {children}
    </DashboardShell>
  )
}
