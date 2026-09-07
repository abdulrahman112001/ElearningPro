import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Arabic script has no case and its letters change shape by position, so
// concatenating two isolated letters (Western-style "first + last" initials)
// often renders with a stray hamza/diacritic mark that looks broken. A single
// letter always renders cleanly in its initial form, so Arabic names get one
// letter while Latin names keep the familiar two-letter initials.
const ARABIC_SCRIPT_RE = /[؀-ۿ]/

export function getInitials(name: string | null | undefined): string {
  if (!name) return "U"
  const trimmed = name.trim()
  const parts = trimmed.split(/\s+/)

  if (ARABIC_SCRIPT_RE.test(trimmed)) {
    return parts[0].charAt(0)
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function formatPrice(price: number, currency: string = "EGP"): string {
  if (price === 0) return "مجاني"

  const formatter = new Intl.NumberFormat("ar-EG", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  const formattedPrice = formatter.format(price)

  if (currency === "EGP") {
    return `${formattedPrice} ج.م`
  } else if (currency === "USD") {
    return `$${formattedPrice}`
  }

  return `${formattedPrice} ${currency}`
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 د"

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) {
    return `${hours} س ${mins} د`
  } else if (hours > 0) {
    return `${hours} ساعة`
  } else {
    return `${mins} دقيقة`
  }
}
