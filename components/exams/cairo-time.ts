/**
 * Exam windows are entered and displayed in Egypt time (Africa/Cairo),
 * whatever the browser's own time zone is. Values are stored as UTC ISO.
 */
export const EXAM_TIME_ZONE = "Africa/Cairo"

function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EXAM_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"))
  return Math.round((asUtc - date.getTime()) / 60_000)
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" in Cairo time, for <input type="datetime-local">. */
export function isoToCairoInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const shifted = new Date(date.getTime() + offsetMinutes(date) * 60_000)
  return shifted.toISOString().slice(0, 16)
}

/** "YYYY-MM-DDTHH:mm" entered as Cairo time -> UTC ISO (null when empty/invalid). */
export function cairoInputToIso(value: string | null | undefined): string | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  // Two passes handle the DST boundary.
  const first = naive - offsetMinutes(new Date(naive)) * 60_000
  const second = naive - offsetMinutes(new Date(first)) * 60_000
  return new Date(second).toISOString()
}

/** Human date/time in Cairo time for the given UI locale. */
export function formatCairo(iso: string | Date | null | undefined, locale: string): string {
  if (!iso) return ""
  const date = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: EXAM_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
