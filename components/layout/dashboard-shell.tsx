"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { AvatarName } from "@/components/shared/avatar-name"
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav"

export interface DashboardNavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Only active on an exact pathname match (use for the overview link) */
  exact?: boolean
  /** Small trailing element, e.g. a count badge */
  badge?: React.ReactNode
}

export interface DashboardNavSection {
  id: string
  /** Section heading; omit for an unlabeled top group */
  label?: string
  items: DashboardNavItem[]
}

export interface DashboardShellProps {
  /** Panel name shown at the top of the sidebar, e.g. "Instructor Panel" */
  title: string
  /** Small caption under the title */
  subtitle?: string
  /** Icon in the brand tile next to the title */
  icon: LucideIcon
  sections: DashboardNavSection[]
  children: React.ReactNode
}

/** Returns the href of the most specific nav item matching the pathname. */
function useActiveHref(sections: DashboardNavSection[]): string | null {
  const pathname = usePathname() ?? ""
  let best: string | null = null
  for (const section of sections) {
    for (const item of section.items) {
      const match = item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/")
      if (match && (!best || item.href.length > best.length)) best = item.href
    }
  }
  return best
}

/**
 * Shared chrome for the student, instructor and admin dashboards:
 * a sectioned sidebar on desktop (lg+) and a scrollable tab bar on mobile.
 * Role-specific shells only declare their sections.
 */
export function DashboardShell({
  title,
  subtitle,
  icon: PanelIcon,
  sections,
  children,
}: DashboardShellProps) {
  const t = useTranslations("nav.dashboard")
  const { data: session } = useSession()
  const activeHref = useActiveHref(sections)

  const mobileLinks = sections.flatMap((section) =>
    section.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      active: item.href === activeHref,
      section: section.id,
    }))
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/30 dark:bg-background">
      <div className="flex flex-col lg:flex-row">
        <DashboardMobileNav label={title} links={mobileLinks} />

        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-e bg-card/60 backdrop-blur-sm lg:flex xl:w-72">
          <div className="flex items-center gap-3 px-5 pb-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-primary/25">
              <PanelIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{title}</p>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <nav
            aria-label={title}
            className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2 [scrollbar-width:thin]"
          >
            {sections.map((section) => (
              <div key={section.id} className="space-y-1">
                {section.label && (
                  <p className="type-overline px-3 pb-1 pt-1">{section.label}</p>
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = item.href === activeHref
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            active
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-primary"
                            />
                          )}
                          <Icon
                            className={cn(
                              "h-[1.125rem] w-[1.125rem] shrink-0 transition-colors",
                              active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                          {item.badge && <span className="ms-auto">{item.badge}</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {session?.user && (
            <div className="border-t p-3">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <AvatarName
                  size="sm"
                  name={session.user.name}
                  image={session.user.image}
                  secondary={
                    session.user.role
                      ? t(`roles.${session.user.role}` as "roles.STUDENT")
                      : session.user.email
                  }
                />
              </div>
            </div>
          )}
        </aside>

        {/* Page content */}
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Pages that still wrap themselves in .container don't get double gutters */}
          <div className="mx-auto w-full max-w-7xl [&>.container]:max-w-none [&>.container]:px-0 [&>.container]:py-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
