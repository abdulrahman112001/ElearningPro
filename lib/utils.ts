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

export type AppLocale = "ar" | "en"

/**
 * Formats a price for the active UI locale. Pass the locale from
 * `useLocale()` (client) or `getLocale()` (server); it defaults to Arabic.
 */
export function formatPrice(
  price: number,
  currency: string = "EGP",
  locale: AppLocale | string = "ar"
): string {
  const isAr = locale !== "en"
  if (price === 0) return isAr ? "مجاني" : "Free"

  const formatter = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  const formattedPrice = formatter.format(price)

  if (currency === "EGP") {
    return isAr ? `${formattedPrice} ج.م` : `${formattedPrice} EGP`
  } else if (currency === "USD") {
    return `$${formattedPrice}`
  }

  return `${formattedPrice} ${currency}`
}

/** Formats a duration given in minutes for the active UI locale. */
export function formatDuration(
  minutes: number | null | undefined,
  locale: AppLocale | string = "ar"
): string {
  const isAr = locale !== "en"
  if (!minutes || minutes <= 0) return isAr ? "0 د" : "0m"

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) {
    return isAr ? `${hours} س ${mins} د` : `${hours}h ${mins}m`
  } else if (hours > 0) {
    return isAr ? `${hours} ساعة` : `${hours} ${hours === 1 ? "hour" : "hours"}`
  } else {
    return isAr ? `${mins} دقيقة` : `${mins} ${mins === 1 ? "minute" : "minutes"}`
  }
}
