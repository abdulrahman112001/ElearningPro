import { cn } from "@/lib/utils"

/** Organization logo, or its initial on the brand color. Server-safe. */
export function OrgLogo({
  name,
  logoUrl,
  color,
  className,
}: {
  name: string
  logoUrl?: string | null
  color?: string | null
  className?: string
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={cn("h-12 w-12 shrink-0 rounded-lg border bg-white object-contain", className)} />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white", className)}
      style={{ backgroundColor: color || "#4f46e5" }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}
