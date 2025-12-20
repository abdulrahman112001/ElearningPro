import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
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
