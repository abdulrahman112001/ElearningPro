"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { DoorOpen, Pencil, Trash2, User, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { dayName, formatClock } from "./format"

export interface TimetableItem {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  subject: string
  room: string | null
  group?: { id: string; name: string } | null
  teacher?: { id: string; name: string | null } | null
  organization?: { id: string; name: string } | null
}

/**
 * Week view: one column per day (stacked on phones), periods sorted by time.
 * Shows the class and/or teacher depending on `show`. Optional edit / delete
 * buttons for the school timetable editor.
 */
export function WeekTimetable({
  entries,
  days,
  show = { group: true, teacher: true },
  onEdit,
  onDelete,
  highlightToday = true,
}: {
  entries: TimetableItem[]
  days: number[]
  show?: { group?: boolean; teacher?: boolean; organization?: boolean }
  onEdit?: (e: TimetableItem) => void
  onDelete?: (e: TimetableItem) => void
  highlightToday?: boolean
}) {
  const t = useTranslations("school")
  const locale = useLocale()
  const [today, setToday] = React.useState<number | null>(null)
  React.useEffect(() => setToday(new Date().getDay()), [])

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", days.length >= 6 ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-5")}>
      {days.map((d) => {
        const list = entries
          .filter((e) => e.dayOfWeek === d)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
        const isToday = highlightToday && today === d
        return (
          <section key={d} className={cn("flex min-w-0 flex-col rounded-lg border bg-card shadow-soft", isToday && "ring-2 ring-primary/40")}>
            <header className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="text-sm font-semibold">{dayName(locale, d)}</h3>
              {isToday && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{t("timetable.today")}</span>}
            </header>
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("timetable.free")}</p>
            ) : (
              <ul className="divide-y">
                {list.map((e) => (
                  <li key={e.id} className="space-y-1 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-medium">{e.subject}</p>
                      {(onEdit || onDelete) && (
                        <div className="flex shrink-0 gap-0.5">
                          {onEdit && (
                            <button type="button" onClick={() => onEdit(e)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("timetable.edit")}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDelete && (
                            <button type="button" onClick={() => onDelete(e)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={t("timetable.delete")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground" dir="ltr">
                      {formatClock(locale, e.startTime)} – {formatClock(locale, e.endTime)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {show.group && e.group && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {e.group.name}
                        </span>
                      )}
                      {show.teacher && e.teacher?.name && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {e.teacher.name}
                        </span>
                      )}
                      {e.room && (
                        <span className="inline-flex items-center gap-1">
                          <DoorOpen className="h-3 w-3" />
                          {e.room}
                        </span>
                      )}
                      {show.organization && e.organization && <span>{e.organization.name}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
