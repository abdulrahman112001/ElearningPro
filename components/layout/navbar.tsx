"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import {
  Menu,
  X,
  Search,
  Moon,
  Sun,
  Globe,
  LogOut,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Heart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarName } from "@/components/shared/avatar-name"
import { cn, getInitials } from "@/lib/utils"

/** Brand mark shared by the navbar and footer. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 shadow-sm shadow-primary/30 ring-1 ring-inset ring-white/15">
        <GraduationCap className="h-5 w-5 text-white" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold tracking-normal">E-Learn</span>
    </span>
  )
}

const iconButton =
  "h-9 w-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"

export function Navbar() {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale?.toLowerCase().startsWith("ar")
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  // Slightly stronger surface once the page scrolls under the header
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navLinks = [
    { href: "/", label: t("navigation.home") },
    { href: "/courses", label: t("navigation.courses") },
    { href: "/categories", label: t("navigation.categories") },
    { href: "/instructors", label: t("navigation.instructors") },
    { href: "/pricing", label: t("navigation.pricing") },
  ]

  const isLinkActive = (href: string) =>
    href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href))

  const toggleLanguage = () => {
    const newLocale = isRTL ? "en" : "ar"
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`
    window.location.reload()
  }

  const getDashboardLink = () => {
    if (!session?.user) return "/login"
    switch (session.user.role) {
      case "ADMIN":
        return "/admin"
      case "INSTRUCTOR":
        return "/instructor"
      default:
        return "/student"
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-[background-color,box-shadow,border-color] duration-200",
        scrolled
          ? "border-border bg-background/80 shadow-soft supports-[backdrop-filter]:bg-background/70"
          : "border-transparent bg-background/60 supports-[backdrop-filter]:bg-background/50"
      )}
    >
      <nav className="container flex h-16 items-center gap-3">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <BrandLogo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>

        {/* Desktop Navigation */}
        <div className="ms-4 hidden items-center gap-0.5 lg:flex">
          {navLinks.map((link) => {
            const active = isLinkActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Search */}
        <div className="mx-auto hidden w-full max-w-sm flex-1 md:flex lg:mx-6">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute start-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("hero.searchPlaceholder")}
              aria-label={t("common.search")}
              className="h-9 rounded-md border-transparent bg-muted/70 pe-4 ps-9 shadow-none transition-colors placeholder:text-muted-foreground/80 hover:bg-muted focus-visible:border-input focus-visible:bg-background"
            />
          </div>
        </div>

        {/* End Section */}
        <div className="ms-auto flex items-center gap-1 md:ms-0">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(iconButton, "md:hidden")}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-label={t("common.search")}
            aria-expanded={isSearchOpen}
          >
            <Search className="h-[1.125rem] w-[1.125rem]" />
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(iconButton, "relative")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={t("a11y.toggleTheme")}
          >
            <Sun className="h-[1.125rem] w-[1.125rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.125rem] w-[1.125rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">{t("a11y.toggleTheme")}</span>
          </Button>

          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={iconButton}
            onClick={toggleLanguage}
            aria-label={t("a11y.switchLanguage")}
          >
            <Globe className="h-[1.125rem] w-[1.125rem]" />
          </Button>

          {/* User Menu */}
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative ms-1 h-9 w-9 rounded-full p-0 ring-offset-background hover:bg-transparent"
                  aria-label={t("a11y.userMenu")}
                >
                  <Avatar className="h-9 w-9 ring-2 ring-border transition-shadow hover:ring-primary/40">
                    <AvatarImage
                      src={session.user.image || ""}
                      alt={session.user.name || ""}
                    />
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(session.user.name || "U")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 rounded-lg p-1.5 shadow-floating"
                align={isRTL ? "start" : "end"}
                sideOffset={8}
                forceMount
              >
                <div dir={isRTL ? "rtl" : "ltr"}>
                  <DropdownMenuLabel className="p-2 font-normal">
                    <AvatarName
                      name={session.user.name}
                      image={session.user.image}
                      secondary={session.user.email}
                    />
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={getDashboardLink()} className="cursor-pointer gap-2 py-2">
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      {t("student.dashboard")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/student/courses" className="cursor-pointer gap-2 py-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      {t("student.myCourses")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/student/wishlist" className="cursor-pointer gap-2 py-2">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      {t("student.wishlist")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/student/settings" className="cursor-pointer gap-2 py-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      {t("student.settings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="cursor-pointer gap-2 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("auth.logout")}
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="ms-1 hidden items-center gap-2 sm:flex">
              <Button variant="ghost" asChild>
                <Link href="/login">{t("auth.login")}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{t("auth.register")}</Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(iconButton, "lg:hidden")}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? t("a11y.closeMenu") : t("a11y.openMenu")}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile Search */}
      {isSearchOpen && (
        <div className="animate-slide-down border-t bg-background/95 md:hidden">
          <div className="container py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("hero.searchPlaceholder")}
                aria-label={t("common.search")}
                className="h-10 bg-muted/60 pe-4 ps-9"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="animate-slide-down border-t bg-background/95 shadow-elevated lg:hidden">
          <div className="container space-y-1 py-3">
            {navLinks.map((link) => {
              const active = isLinkActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )
            })}
            {session?.user ? (
              <div className="mt-2 border-t pt-3">
                <Link
                  href={getDashboardLink()}
                  className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  {t("student.dashboard")}
                </Link>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-3">
                <Button variant="outline" asChild>
                  <Link href="/login">{t("auth.login")}</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">{t("auth.register")}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
