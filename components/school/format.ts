/** Formatting helpers shared by the school / homework UI (client and server). */

export function intlLocale(locale: string) {
  return locale === "ar" ? "ar-EG" : "en-US"
}

/** Weekday name, 0 = Sunday. 2023-01-01 was a Sunday. */
export function dayName(locale: string, day: number, style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: style, timeZone: "UTC" }).format(
    new Date(Date.UTC(2023, 0, 1 + day))
  )
}

/** "08:30" in the viewer's locale (e.g. ٨:٣٠ ص). */
export function formatClock(locale: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2023, 0, 1, h, m))
  )
}

/** Date -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Date -> value for <input type="date">. */
export function toDateInput(value: string | Date | null | undefined) {
  return toLocalInput(value).slice(0, 10)
}

/** Relative time ("in 3 days", "2 hours ago") in the viewer's locale. */
export function relativeTime(locale: string, target: string | Date, now = Date.now()) {
  const diff = new Date(target).getTime() - now
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" })
  const abs = Math.abs(diff)
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR
  if (abs < HOUR) return rtf.format(Math.round(diff / MIN), "minute")
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour")
  return rtf.format(Math.round(diff / DAY), "day")
}

export async function readError(res: Response): Promise<{ error?: string; code?: string; [k: string]: any }> {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/** Egyptian school week: Sunday to Thursday, Saturday optional. */
export function schoolDays(withSaturday: boolean, entries: { dayOfWeek: number }[] = []) {
  const days = [0, 1, 2, 3, 4]
  const used = new Set(entries.map((e) => e.dayOfWeek))
  if (withSaturday || used.has(6)) days.unshift(6)
  if (used.has(5)) days.push(5)
  return days
}
