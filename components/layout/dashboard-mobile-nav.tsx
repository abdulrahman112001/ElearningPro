"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardMobileNavProps {
  label: string
  links: { href: string; label: string; icon: LucideIcon; active: boolean }[]
}

/**
 * Below the lg breakpoint the dashboard sidebar is hidden, so every section
 * is offered here as a horizontally scrollable tab bar.
 */
export function DashboardMobileNav({ label, links }: DashboardMobileNavProps) {
  return (
    <nav
      aria-label={label}
      className="lg:hidden sticky top-16 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map(({ href, label: text, icon: Icon, active }) => (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
