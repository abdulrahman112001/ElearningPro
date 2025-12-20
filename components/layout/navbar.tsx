"use client"

import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import {
  Menu,
  X,
  Search,
  Moon,
  Sun,
  Globe,
  User,
  LogOut,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Heart,
  ShoppingCart,
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
import { cn, getInitials } from "@/lib/utils"

export function Navbar() {
  const t = useTranslations()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const navLinks = [
    { href: "/", label: t("navigation.home") },
    { href: "/courses", label: t("navigation.courses") },
    { href: "/categories", label: t("navigation.categories") },
    { href: "/instructors", label: t("navigation.instructors") },
    { href: "/pricing", label: t("navigation.pricing") },
  ]

  const toggleLanguage = () => {
    const currentLocale = document.cookie.includes("locale=ar") ? "ar" : "en"
    const newLocale = currentLocale === "ar" ? "en" : "ar"
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold hidden sm:inline-block">
            E-Learn
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("hero.searchPlaceholder")}
              className="ps-10 pe-4"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Language Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleLanguage}>
            <Globe className="h-5 w-5" />
          </Button>

          {/* User Menu */}
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={session.user.image || ""}
                      alt={session.user.name || ""}
                    />
                    <AvatarFallback>
                      {getInitials(session.user.name || "U")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={getDashboardLink()}>
                    <LayoutDashboard className="me-2 h-4 w-4" />
                    {t("student.dashboard")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/student/courses">
                    <BookOpen className="me-2 h-4 w-4" />
                    {t("student.myCourses")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/student/wishlist">
                    <Heart className="me-2 h-4 w-4" />
                    {t("student.wishlist")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/student/settings">
                    <Settings className="me-2 h-4 w-4" />
                    {t("student.settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive"
                >
                  <LogOut className="me-2 h-4 w-4" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
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
            className="lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
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
        <div className="md:hidden border-t p-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("hero.searchPlaceholder")}
              className="ps-10 pe-4"
            />
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden border-t">
          <div className="container py-4 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!session?.user && (
              <div className="flex flex-col gap-2 pt-4 border-t">
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
