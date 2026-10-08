"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BrandLogo } from "@/components/layout/navbar"

export function Footer() {
  const t = useTranslations()

  const quickLinks = [
    { href: "/courses", label: t("navigation.courses") },
    { href: "/categories", label: t("navigation.categories") },
    { href: "/instructors", label: t("navigation.instructors") },
    { href: "/pricing", label: t("navigation.pricing") },
    { href: "/about", label: t("navigation.about") },
  ]

  const supportLinks = [
    { href: "/help", label: t("footer.helpCenter") },
    { href: "/faq", label: t("footer.faq") },
    { href: "/contact", label: t("footer.contactUs") },
  ]

  const legalLinks = [
    { href: "/terms", label: t("footer.termsOfService") },
    { href: "/privacy", label: t("footer.privacyPolicy") },
  ]

  const socialLinks = [
    { href: "#", icon: Facebook, label: "Facebook" },
    { href: "#", icon: Twitter, label: "Twitter" },
    { href: "#", icon: Instagram, label: "Instagram" },
    { href: "#", icon: Youtube, label: "YouTube" },
    { href: "#", icon: Linkedin, label: "LinkedIn" },
  ]

  const columns = [
    { title: t("footer.quickLinks"), links: quickLinks },
    { title: t("footer.support"), links: supportLinks },
    { title: t("footer.legal"), links: legalLinks },
  ]

  return (
    <footer className="relative border-t bg-card/50">
      {/* Hairline brand accent along the top edge */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-12">
          {/* Brand + newsletter */}
          <div className="col-span-2 md:col-span-3 lg:col-span-5">
            <Link
              href="/"
              className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <BrandLogo />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("footer.aboutText")}
            </p>

            <div className="mt-6 max-w-md rounded-lg border bg-background/60 p-4 shadow-soft">
              <h4 className="text-sm font-semibold">{t("footer.newsletter")}</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("footer.newsletterText")}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder={t("footer.emailPlaceholder")}
                    className="h-9"
                    aria-label={t("footer.emailPlaceholder")}
                  />
                </div>
                <Button className="shrink-0">{t("footer.subscribe")}</Button>
              </div>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((column, i) => (
            <div
              key={column.title}
              className={i === 0 ? "lg:col-span-2 lg:col-start-7" : "lg:col-span-2"}
            >
              <h4 className="type-overline text-foreground/80">{column.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 md:flex-row">
          <p className="text-center text-sm text-muted-foreground md:text-start">
            © {new Date().getFullYear()} E-Learn. {t("footer.allRightsReserved")}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {t("footer.followUs")}:
            </span>
            <div className="flex gap-1">
              {socialLinks.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <social.icon className="h-4 w-4" />
                  <span className="sr-only">{social.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
