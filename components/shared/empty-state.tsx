import * as React from "react"
import { Inbox, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Usually a <Button> or <Button asChild><Link/></Button> */
  action?: React.ReactNode
  /** "card" draws a dashed bordered box; "plain" is borderless (inside a SectionCard) */
  variant?: "card" | "plain"
  /** Compact spacing for small panels */
  size?: "default" | "sm"
  className?: string
}

/**
 * Friendly placeholder for lists and pages with no data yet.
 *
 * @example
 * <EmptyState icon={BookOpen} title={t("noCourses")} description={t("noCoursesHint")}
 *   action={<Button asChild><Link href="/courses">{t("browse")}</Link></Button>} />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "card",
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-4 py-8" : "gap-3 px-6 py-12 sm:py-16",
        variant === "card" && "rounded-lg border border-dashed bg-card/50",
        className
      )}
    >
      <div className="relative mb-1">
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-150 rounded-full bg-primary/5 blur-xl"
        />
        <div
          className={cn(
            "relative flex items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-soft",
            size === "sm" ? "h-10 w-10" : "h-14 w-14"
          )}
        >
          <Icon className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} aria-hidden="true" />
        </div>
      </div>
      <h3 className={cn("font-semibold", size === "sm" ? "text-sm" : "text-base sm:text-lg")}>
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
