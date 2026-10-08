import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SectionCardProps {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Optional icon shown before the title */
  icon?: LucideIcon
  /** Button / link aligned to the inline-end of the header */
  action?: React.ReactNode
  children?: React.ReactNode
  /** Footer row (pagination, "view all"…) separated by a hairline */
  footer?: React.ReactNode
  className?: string
  /** Classes for the body wrapper. Use "p-0" for edge-to-edge tables. */
  contentClassName?: string
  /** Render the header with a hairline divider below it (default true) */
  divided?: boolean
}

/**
 * The standard content container for dashboards: a card with a compact
 * header (title, description, action) and a padded body.
 *
 * @example
 * <SectionCard title={t("recent")} action={<Button variant="ghost" size="sm">{t("viewAll")}</Button>}>
 *   ...
 * </SectionCard>
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  footer,
  className,
  contentClassName,
  divided = true,
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || action)
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-soft",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6",
            divided && "border-b"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              {title && <h2 className="type-h4 break-words">{title}</h2>}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn("flex-1 p-4 sm:p-6", contentClassName)}>{children}</div>
      {footer && (
        <div className="border-t bg-muted/30 px-4 py-3 sm:px-6">{footer}</div>
      )}
    </section>
  )
}
