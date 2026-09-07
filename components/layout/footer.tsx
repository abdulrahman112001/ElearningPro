"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  GraduationCap,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

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

  return (
    <footer className="bg-muted/30 border-t">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 shadow-md shadow-primary/20">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">E-Learn</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {t("footer.aboutText")}
            </p>
            {/* Newsletter */}
            <div>
              <h4 className="font-semibold mb-2">{t("footer.newsletter")}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t("footer.newsletterText")}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder={t("footer.emailPlaceholder")}
                  className="max-w-[240px] rounded-lg"
                  aria-label={t("footer.emailPlaceholder")}
                />
                <Button variant="gradient">{t("footer.subscribe")}</Button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.support")}</h4>
            <ul className="space-y-2">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.legal")}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} E-Learn.{" "}
            {t("footer.allRightsReserved")}
          </p>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {t("footer.followUs")}:
            </span>
            <div className="flex gap-2">
              {socialLinks.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <social.icon className="h-[1.125rem] w-[1.125rem]" />
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
