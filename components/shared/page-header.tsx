import * as React from "react"
import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  /** Omit for the current (last) page */
  href?: string
}

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Lucide icon rendered in a tinted brand tile next to the title */
  icon?: LucideIcon
  /** Buttons / menus aligned to the inline-end side (wraps below on mobile) */
  actions?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  className?: string
  /** Extra content under the title row (tabs, filters…) */
  children?: React.ReactNode
}

/**
 * Top-of-page heading used by every dashboard page so titles, spacing and
 * actions line up the same way for students, teachers and admins.
 *
 * @example
 * <PageHeader icon={Users} title={t("title")} description={t("subtitle")}
 *   actions={<Button>{t("add")}</Button>} />
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
  className,
  children,
}: PageHeaderProps) {
  const t = useTranslations("shared")
  return (
    <header className={cn("mb-6 space-y-4 sm:mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label={t("breadcrumb")}>
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {crumb.href && !last ? (
                    <Link
                      href={crumb.href}
                      className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(last && "font-medium text-foreground")}
                      aria-current={last ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!last && (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 opacity-60 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-inset ring-primary/15 sm:h-12 sm:w-12">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <h1 className="type-h1 text-balance break-words">{title}</h1>
            {description && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {children}
    </header>
  )
}
