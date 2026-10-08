"use client"

import { Fragment, useEffect, useRef } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DashboardMobileNavLink {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
  /** Links with different sections get a hairline divider between them */
  section?: string
}

interface DashboardMobileNavProps {
  label: string
  links: DashboardMobileNavLink[]
}

/**
 * Below the lg breakpoint the dashboard sidebar is hidden, so every section
 * is offered here as a horizontally scrollable tab bar. The active tab is
 * scrolled into view on navigation.
 */
export function DashboardMobileNav({ label, links }: DashboardMobileNavProps) {
  const activeRef = useRef<HTMLAnchorElement | null>(null)
  const activeHref = links.find((l) => l.active)?.href

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [activeHref])

  return (
    <nav
      aria-label={label}
      className="sticky top-16 z-30 border-b bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 lg:hidden"
    >
      <ul className="flex items-center gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map(({ href, label: text, icon: Icon, active, section }, i) => {
          const newSection = i > 0 && section !== undefined && section !== links[i - 1].section
          return (
            <Fragment key={href}>
              {newSection && (
                <li aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
              )}
              <li className="shrink-0">
                <Link
                  href={href}
                  ref={active ? activeRef : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {text}
                </Link>
              </li>
            </Fragment>
          )
        })}
      </ul>
    </nav>
  )
}
