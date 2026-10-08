import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, getInitials } from "@/lib/utils"

export interface AvatarNameProps {
  name: string | null | undefined
  image?: string | null
  /** Secondary line: email, role, "2 hours ago"… */
  secondary?: React.ReactNode
  /** Extra inline content after the name (badge, verified tick…) */
  badge?: React.ReactNode
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = {
  sm: { avatar: "h-8 w-8", fallback: "text-xs", name: "text-sm", secondary: "text-xs" },
  md: { avatar: "h-10 w-10", fallback: "text-sm", name: "text-sm", secondary: "text-xs" },
  lg: { avatar: "h-12 w-12", fallback: "text-base", name: "text-base", secondary: "text-sm" },
} as const

/**
 * Avatar + name + secondary line, for tables, lists and headers. Long
 * names/emails truncate instead of breaking the layout.
 *
 * @example
 * <AvatarName name={user.name} image={user.image} secondary={user.email} />
 */
export function AvatarName({
  name,
  image,
  secondary,
  badge,
  size = "md",
  className,
}: AvatarNameProps) {
  const s = sizes[size]
  const displayName = name?.trim() || "—"
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Avatar className={cn(s.avatar, "ring-2 ring-background")}>
        {image ? <AvatarImage src={image} alt={displayName} className="object-cover" /> : null}
        <AvatarFallback
          className={cn("bg-primary/10 font-semibold text-primary", s.fallback)}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className={cn("truncate font-medium leading-tight", s.name)}>{displayName}</p>
          {badge}
        </div>
        {secondary && (
          <div className={cn("mt-0.5 truncate leading-tight text-muted-foreground", s.secondary)}>
            {secondary}
          </div>
        )}
      </div>
    </div>
  )
}
