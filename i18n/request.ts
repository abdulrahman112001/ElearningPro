import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

export const locales = ["ar", "en"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "ar"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge(primary: unknown, fallback: unknown): unknown {
  // If primary is missing, use fallback
  if (primary === undefined || primary === null) return fallback

  // Merge objects recursively
  if (isPlainObject(primary) && isPlainObject(fallback)) {
    const result: Record<string, unknown> = { ...fallback }
    for (const [key, value] of Object.entries(primary)) {
      result[key] = deepMerge(value, (fallback as any)[key])
    }
    return result
  }

  // Prefer primary for primitives/arrays/functions
  return primary
}

export default getRequestConfig(async () => {
  const cookieStore = cookies()
  const locale = (cookieStore.get("locale")?.value as Locale) || defaultLocale

  const primaryMessages = (await import(`../messages/${locale}.json`)).default
  const fallbackMessages =
    locale === defaultLocale
      ? undefined
      : (await import(`../messages/${defaultLocale}.json`)).default

  const messages = fallbackMessages
    ? (deepMerge(primaryMessages, fallbackMessages) as any)
    : primaryMessages

  return {
    locale,
    messages,
    onError(error) {
      // Suppress noisy missing-message errors (we provide a fallback)
      if ((error as any)?.code === "MISSING_MESSAGE") return
      console.error(error)
    },
    getMessageFallback({ namespace, key }) {
      // Final fallback if both primary+default are missing
      return namespace ? `${namespace}.${key}` : key
    },
  }
})
