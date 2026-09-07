import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SectionHeaderAction {
  href: string
  label: string
}

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: "start" | "center"
  action?: SectionHeaderAction
}

/**
 * Consistent section heading used across every homepage block:
 * eyebrow (optional) -> title -> subtitle, with an optional
 * "see all" action aligned to the opposite side on wide screens.
 */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "start",
  action,
}: SectionHeaderProps) {
  const isCenter = align === "center"

  return (
    <div
      className={`mb-12 flex flex-col gap-4 ${
        isCenter
          ? "items-center text-center"
          : "md:flex-row md:items-end md:justify-between md:text-start text-center"
      }`}
    >
      <div className={isCenter ? "max-w-2xl" : ""}>
        {eyebrow && <span className="eyebrow mb-3">{eyebrow}</span>}
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-muted-foreground md:text-lg">{subtitle}</p>
        )}
      </div>

      {action && !isCenter && (
        <Button variant="outline" className="border-2" asChild>
          <Link href={action.href}>
            {action.label}
            <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      )}
    </div>
  )
}
