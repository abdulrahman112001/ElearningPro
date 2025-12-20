"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
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
  Gift,
  Wallet,
  Bell,
} from "lucide-react"

const sidebarLinks = [
  {
    title: "overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "instructors",
    href: "/admin/instructors",
    icon: Shield,
  },
  {
    title: "courses",
    href: "/admin/courses",
    icon: BookOpen,
  },
  {
    title: "categories",
    href: "/admin/categories",
    icon: Tag,
  },
  {
    title: "coupons",
    href: "/admin/coupons",
    icon: Gift,
  },
  {
    title: "payments",
    href: "/admin/payments",
    icon: DollarSign,
  },
  {
    title: "withdrawals",
    href: "/admin/withdrawals",
    icon: Wallet,
  },
  {
    title: "reviews",
    href: "/admin/reviews",
    icon: MessageSquare,
  },
  {
    title: "analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "notifications",
    href: "/admin/notifications",
    icon: Bell,
  },
  {
    title: "settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar() {
  const t = useTranslations("admin")
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/admin") {
      return (
        pathname === "/admin" ||
        pathname === "/ar/admin" ||
        pathname === "/en/admin"
      )
    }
    return pathname.includes(href)
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 border-l bg-background min-h-[calc(100vh-4rem)] sticky top-16">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">{t("adminPanel")}</h2>
      </div>
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
                    active
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{t(link.title)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
