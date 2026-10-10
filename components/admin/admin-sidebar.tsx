"use client"

import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  DollarSign,
  BarChart3,
  Tag,
  MessageSquare,
  Shield,
  ShieldCheck,
  Gift,
  Wallet,
  Bell,
  Activity,
  MessagesSquare,
  GraduationCap,
  Sparkles,
  Building2,
  Send,
  Banknote,
  Ticket,
  Lock,
} from "lucide-react"
import { DashboardShell, type DashboardNavSection } from "@/components/layout/dashboard-shell"

/** Builds the admin navigation, grouped into labelled sections. */
function useAdminSections(): DashboardNavSection[] {
  const t = useTranslations("admin")
  const n = useTranslations("nav.dashboard")
  return [
    {
      id: "general",
      items: [
        { href: "/admin", label: t("overview"), icon: LayoutDashboard, exact: true },
        { href: "/admin/analytics", label: t("analytics"), icon: BarChart3 },
        { href: "/admin/activity", label: n("activity"), icon: Activity },
        { href: "/admin/ai", label: n("ai"), icon: Sparkles },
      ],
    },
    {
      id: "people",
      label: n("sections.people"),
      items: [
        { href: "/admin/users", label: t("users"), icon: Users },
        { href: "/admin/instructors", label: t("instructors"), icon: Shield },
        { href: "/admin/organizations", label: n("organizations"), icon: Building2 },
        { href: "/admin/conversations", label: n("conversations"), icon: MessagesSquare },
        { href: "/admin/messaging", label: n("messaging"), icon: Send },
      ],
    },
    {
      id: "content",
      label: n("sections.content"),
      items: [
        { href: "/admin/courses", label: t("courses"), icon: BookOpen },
        { href: "/admin/categories", label: t("categories"), icon: Tag },
        { href: "/admin/grade-levels", label: n("gradeLevels"), icon: GraduationCap },
        { href: "/admin/reviews", label: t("reviews"), icon: MessageSquare },
      ],
    },
    {
      id: "finance",
      label: n("sections.finance"),
      items: [
        { href: "/admin/payments", label: t("payments"), icon: DollarSign },
        { href: "/admin/manual-payments", label: n("manualPayments"), icon: Banknote },
        { href: "/admin/codes", label: n("codes"), icon: Ticket },
        { href: "/admin/withdrawals", label: t("withdrawals"), icon: Wallet },
        { href: "/admin/coupons", label: t("coupons"), icon: Gift },
      ],
    },
    {
      id: "system",
      label: n("sections.system"),
      items: [
        { href: "/admin/notifications", label: t("notifications"), icon: Bell },
        { href: "/admin/security", label: n("security"), icon: Lock },
        { href: "/admin/settings", label: t("settings"), icon: Settings },
      ],
    },
  ]
}

/** Admin dashboard chrome: sectioned sidebar (desktop) + tab bar (mobile). */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin")
  const n = useTranslations("nav.dashboard")
  const sections = useAdminSections()
  return (
    <DashboardShell
      title={t("adminPanel")}
      subtitle={n("adminSubtitle")}
      icon={ShieldCheck}
      sections={sections}
    >
      {children}
    </DashboardShell>
  )
}