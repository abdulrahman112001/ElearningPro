/**
 * Client-safe date helpers. Session times are stored in UTC and always shown
 * in Africa/Cairo, whatever the viewer's device time zone is.
 */
export const CAIRO_TZ = "Africa/Cairo"

export const intlLocale = (locale: string) => (locale === "ar" ? "ar-EG" : "en-US")

export function cairoFormatters(locale: string) {
  const l = intlLocale(locale)
  return {
    date: new Intl.DateTimeFormat(l, { timeZone: CAIRO_TZ, weekday: "short", day: "numeric", month: "short" }),
    dateLong: new Intl.DateTimeFormat(l, { timeZone: CAIRO_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: new Intl.DateTimeFormat(l, { timeZone: CAIRO_TZ, hour: "numeric", minute: "2-digit" }),
    dateTime: new Intl.DateTimeFormat(l, { timeZone: CAIRO_TZ, dateStyle: "medium", timeStyle: "short" }),
    month: new Intl.DateTimeFormat(l, { timeZone: "UTC", month: "long", year: "numeric" }),
    number: new Intl.NumberFormat(l),
    money: new Intl.NumberFormat(l, { maximumFractionDigits: 2 }),
  }
}

/** Localised weekday name (0 = Sunday). */
export function weekdayName(dayOfWeek: number, locale: string, style: "long" | "short" = "long") {
  // 2023-01-01 was a Sunday.
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: style, timeZone: "UTC" }).format(
    new Date(Date.UTC(2023, 0, 1 + dayOfWeek))
  )
}

/** "17:30" -> localised time label. */
export function formatClock(hhmm: string, locale: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2023, 0, 1, h, m))
  )
}

/** "2026-10" -> localised month name. */
export function formatPeriod(period: string, locale: string) {
  const [y, m] = period.split("-").map(Number)
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  )
}

/** Current Cairo month as "YYYY-MM". */
export function currentPeriod() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: CAIRO_TZ, year: "numeric", month: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  )
  return `${p.year}-${p.month}`
}

/** Shift "YYYY-MM" by n months. */
export function shiftPeriod(period: string, n: number) {
  const [y, m] = period.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Today's date in Cairo as "YYYY-MM-DD" (for date inputs). */
export function cairoToday() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: CAIRO_TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  )
  return `${p.year}-${p.month}-${p.day}`
}

/** Fetch JSON or throw an Error carrying the API's `code`/`error`. */
export async function fetchJson<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(url, {
    ...rest,
    ...(json !== undefined && {
      body: JSON.stringify(json),
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`) as Error & { code?: string; status?: number; data?: any }
    err.code = data?.code
    err.status = res.status
    err.data = data
    throw err
  }
  return data as T
}

/** ISO instant -> { date: "YYYY-MM-DD", time: "HH:mm" } in Cairo (for inputs). */
export function cairoInputParts(iso: string | Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CAIRO_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  )
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}
