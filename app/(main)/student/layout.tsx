import { redirect } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import {
  BookOpen,
  GraduationCap,
  Heart,
  Settings,
  Award,
  Calendar,
  User,
  CreditCard,
  Video,
} from "lucide-react"
import { cn } from "@/lib/utils"

const sidebarLinks = [
  {
    title: "overview",
    href: "/student",
    icon: BookOpen,
  },
  {
    title: "myCourses",
    href: "/student/courses",
    icon: GraduationCap,
  },
  {
    title: "liveClasses",
    href: "/student/live",
    icon: Video,
  },
  {
    title: "certificates",
    href: "/student/certificates",
    icon: Award,
  },
  {
    title: "wishlist",
    href: "/student/wishlist",
    icon: Heart,
  },
  {
    title: "purchases",
    href: "/student/purchases",
    icon: CreditCard,
  },
  {
    title: "profile",
    href: "/student/profile",
    icon: User,
  },
  {
    title: "settings",
    href: "/student/settings",
    icon: Settings,
  },
]

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const t = await getTranslations("student")

  if (!session?.user) {
    redirect("/login?callbackUrl=/student")
  }

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-e bg-background min-h-[calc(100vh-4rem)] sticky top-16">
          <div className="p-6">
            <h2 className="text-lg font-semibold">{t("dashboard")}</h2>
          </div>
          <nav className="flex-1 px-4 pb-6">
            <ul className="space-y-1">
              {sidebarLinks.map((link) => {
                const Icon = link.icon
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
