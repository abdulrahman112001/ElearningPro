"use client"

import { useTranslations } from "next-intl"
import {
  BookOpen,
  Building2,
  LayoutDashboard,
  Mail,
  Megaphone,
  School,
  Settings,
  Users,
  UsersRound,
} from "lucide-react"
import { DashboardShell, type DashboardNavSection } from "@/components/layout/dashboard-shell"

type OrgRole = "OWNER" | "MANAGER" | "TEACHER" | "STUDENT"

interface OrgShellProps {
  orgId: string
  name: string
  type: "CENTER" | "SCHOOL" | "ACADEMY"
  role: OrgRole
  children: React.ReactNode
}

/** Tabbed chrome for /org/[orgId]: what each role sees is decided here. */
export function OrgShell({ orgId, name, type, role, children }: OrgShellProps) {
  const t = useTranslations("organizations")
  const base = `/org/${orgId}`
  const manager = role === "OWNER" || role === "MANAGER"
  const teacher = role === "TEACHER"

  const main: DashboardNavSection = {
    id: "org",
    items: [{ href: base, label: t("tabs.overview"), icon: LayoutDashboard, exact: true }],
  }
  if (manager || teacher) {
    main.items.push(
      { href: `${base}/classes`, label: t("tabs.classes"), icon: UsersRound },
      { href: `${base}/courses`, label: t("tabs.courses"), icon: BookOpen }
    )
  }
  if (type === "SCHOOL") {
    main.items.push({ href: `${base}/school`, label: t("tabs.school"), icon: School })
  }
  if (role === "STUDENT" && type === "SCHOOL") {
    main.items.push({ href: `${base}/school/announcements`, label: t("tabs.announcements"), icon: Megaphone })
  }

  const sections: DashboardNavSection[] = [main]
  if (manager) {
    sections.push({
      id: "manage",
      label: t("tabs.manage"),
      items: [
        { href: `${base}/members`, label: t("tabs.members"), icon: Users },
        { href: `${base}/invites`, label: t("tabs.invites"), icon: Mail },
        { href: `${base}/settings`, label: t("tabs.settings"), icon: Settings },
      ],
    })
  }

  return (
    <DashboardShell title={name} subtitle={`${t(`types.${type}`)} · ${t(`roles.${role}`)}`} icon={Building2} sections={sections}>
      {children}
    </DashboardShell>
  )
}
