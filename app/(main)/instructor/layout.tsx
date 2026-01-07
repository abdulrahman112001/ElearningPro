"use client"

import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  MessageSquare,
  Star,
  Wallet,
  Loader2,
} from "lucide-react"

const sidebarLinks = [
  {
    title: "overview",
    href: "/instructor",
    icon: LayoutDashboard,
  },
  {
    title: "myCourses",
    href: "/instructor/courses",
    icon: BookOpen,
  },
  {
    title: "createCourse",
    href: "/instructor/courses/create",
    icon: Video,
  },
  {
    title: "liveClasses",
    href: "/instructor/live",
    icon: Video,
  },
  {
    title: "students",
    href: "/instructor/students",
    icon: Users,
  },
  {
    title: "reviews",
    href: "/instructor/reviews",
    icon: Star,
  },
  {
    title: "earnings",
    href: "/instructor/earnings",
    icon: DollarSign,
  },
  {
    title: "withdrawals",
    href: "/instructor/withdrawals",
    icon: Wallet,
  },
  {
    title: "analytics",
    href: "/instructor/analytics",
    icon: BarChart3,
  },
  {
    title: "messages",
    href: "/instructor/messages",
    icon: MessageSquare,
  },
  {
    title: "settings",
    href: "/instructor/settings",
    icon: Settings,
  },
]

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const t = useTranslations("instructor")
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (!session?.user) {
      router.replace("/login?callbackUrl=/instructor")
      return
    }

    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      router.replace("/")
    }
  }, [router, session?.user, status])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    return null
  }

  const isActive = (href: string) => {
    if (href === "/instructor") {
      return pathname === "/instructor"
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-l bg-background min-h-[calc(100vh-4rem)] sticky top-16">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">{t("instructorPanel")}</h2>
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
                        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                        active
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
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

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
