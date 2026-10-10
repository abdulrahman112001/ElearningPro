"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Video,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EmptyState, ListSkeleton, PageHeader, SectionCard, StatusBadge } from "@/components/shared"
import { GroupTabs } from "@/components/attendance/group-tabs"
import { SessionDialog, type EditableSession } from "@/components/attendance/session-dialog"
import { cairoFormatters, fetchJson, formatClock, weekdayName } from "@/components/attendance/time"

interface Slot {
  id: string
  dayOfWeek: number
  startTime: string
  durationMin: number
  location: string | null
}

interface SessionRow extends EditableSession {
  cancelled: boolean
  counts: { PRESENT: number; LATE: number; ABSENT: number; EXCUSED: number }
}

interface GroupInfo {
  id: string
  name: string
  mode: string
  location: string | null
}

const WEEK_OPTIONS = [1, 2, 4, 8, 12]

export default function GroupSchedulePage() {
  const groupId = useParams<{ groupId: string }>()?.groupId ?? ""
  const t = useTranslations("attendance.schedule")
  const tg = useTranslations("attendance")
  const tc = useTranslations("common")
  const locale = useLocale()
  const fmt = cairoFormatters(locale)

  const [group, setGroup] = React.useState<GroupInfo | null>(null)
  const [slots, setSlots] = React.useState<Slot[] | null>(null)
  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null)
  const [forbidden, setForbidden] = React.useState(false)

  // slot form
  const [editingSlot, setEditingSlot] = React.useState<Slot | null>(null)
  const [day, setDay] = React.useState("6")
  const [time, setTime] = React.useState("17:00")
  const [duration, setDuration] = React.useState("90")
  const [slotLocation, setSlotLocation] = React.useState("")
  const [savingSlot, setSavingSlot] = React.useState(false)

  const [weeks, setWeeks] = React.useState("4")
  const [generating, setGenerating] = React.useState(false)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingSession, setEditingSession] = React.useState<EditableSession | null>(null)
  const [cancelTarget, setCancelTarget] = React.useState<SessionRow | null>(null)

  const loadSlots = React.useCallback(async () => {
    const data = await fetchJson<{ slots: Slot[] }>(`/api/instructor/groups/${groupId}/schedule`)
    setSlots(data.slots)
  }, [groupId])
  const loadSessions = React.useCallback(async () => {
    const data = await fetchJson<{ sessions: SessionRow[] }>(`/api/instructor/groups/${groupId}/sessions?scope=upcoming`)
    setSessions(data.sessions)
  }, [groupId])

  React.useEffect(() => {
    if (!groupId) return
    fetchJson<GroupInfo>(`/api/instructor/groups/${groupId}`)
      .then(setGroup)
      .catch(() => setForbidden(true))
    loadSlots().catch(() => setForbidden(true))
    loadSessions().catch(() => setSessions([]))
  }, [groupId, loadSlots, loadSessions])

  const resetSlotForm = () => {
    setEditingSlot(null)
    setDay("6")
    setTime("17:00")
    setDuration("90")
    setSlotLocation("")
  }

  const startEditSlot = (slot: Slot) => {
    setEditingSlot(slot)
    setDay(String(slot.dayOfWeek))
    setTime(slot.startTime)
    setDuration(String(slot.durationMin))
    setSlotLocation(slot.location ?? "")
  }

  const saveSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    const durationMin = Number(duration)
    if (!/^\d{2}:\d{2}$/.test(time) || !Number.isInteger(durationMin) || durationMin < 15 || durationMin > 600) {
      toast.error(t("slotInvalid"))
      return
    }
    setSavingSlot(true)
    try {
      const body = { dayOfWeek: Number(day), startTime: time, durationMin, location: slotLocation.trim() || null }
      if (editingSlot) {
        await fetchJson(`/api/instructor/groups/${groupId}/schedule/${editingSlot.id}`, { method: "PATCH", json: body })
      } else {
        await fetchJson(`/api/instructor/groups/${groupId}/schedule`, { method: "POST", json: body })
      }
      toast.success(editingSlot ? t("slotUpdated") : t("slotAdded"))
      resetSlotForm()
      await loadSlots()
    } catch (err: any) {
      toast.error(err?.code === "duplicate_slot" ? t("slotDuplicate") : t("slotFailed"))
    } finally {
      setSavingSlot(false)
    }
  }

  const deleteSlot = async (slot: Slot) => {
    try {
      await fetchJson(`/api/instructor/groups/${groupId}/schedule/${slot.id}`, { method: "DELETE" })
      toast.success(t("slotDeleted"))
      if (editingSlot?.id === slot.id) resetSlotForm()
      await loadSlots()
    } catch {
      toast.error(t("slotFailed"))
    }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetchJson<{ created: number; skipped: number }>(
        `/api/instructor/groups/${groupId}/schedule/generate`,
        { method: "POST", json: { weeks: Number(weeks) } }
      )
      toast.success(t("generated", { created: res.created, skipped: res.skipped }))
      await loadSessions()
    } catch {
      toast.error(t("generateFailed"))
    } finally {
      setGenerating(false)
    }
  }

  const cancelSession = async () => {
    const target = cancelTarget
    setCancelTarget(null)
    if (!target) return
    try {
      await fetchJson(`/api/instructor/groups/${groupId}/sessions/${target.id}`, { method: "DELETE" })
      toast.success(t("sessionCancelled"))
      await loadSessions()
    } catch {
      toast.error(t("sessionCancelFailed"))
    }
  }

  const restoreSession = async (s: SessionRow) => {
    try {
      await fetchJson(`/api/instructor/groups/${groupId}/sessions/${s.id}`, {
        method: "PATCH",
        json: { mode: group?.mode === "ONLINE" ? "ONLINE" : "OFFLINE" },
      })
      toast.success(t("sessionRestored"))
      await loadSessions()
    } catch {
      toast.error(t("sessionCancelFailed"))
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={tg("notFound")}
        action={
          <Button asChild variant="outline">
            <Link href="/instructor/groups">{tg("backToGroups")}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        title={t("title")}
        description={group ? t("subtitle", { name: group.name }) : undefined}
        breadcrumbs={[
          { label: tg("groupsCrumb"), href: "/instructor/groups" },
          { label: group?.name ?? "…", href: `/instructor/groups/${groupId}` },
          { label: t("title") },
        ]}
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setEditingSession(null)
              setDialogOpen(true)
            }}
          >
            <CalendarPlus className="h-4 w-4" />
            {t("addSession")}
          </Button>
        }
      />
      <GroupTabs groupId={groupId} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard icon={Repeat} title={t("weeklyTitle")} description={t("weeklyHint")} contentClassName="p-0">
            {slots === null ? (
              <div className="p-4">
                <ListSkeleton rows={2} />
              </div>
            ) : slots.length === 0 ? (
              <EmptyState variant="plain" size="sm" icon={Repeat} title={t("noSlots")} description={t("noSlotsHint")} />
            ) : (
              <ul className="divide-y">
                {slots.map((slot) => (
                  <li key={slot.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {weekdayName(slot.dayOfWeek, locale)} · {formatClock(slot.startTime, locale)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t("minutes", { count: slot.durationMin })}
                        {slot.location ? ` · ${slot.location}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={tc("edit")}
                        onClick={() => startEditSlot(slot)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={tc("delete")}
                        onClick={() => deleteSlot(slot)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={saveSlot} className="space-y-3 border-t px-4 py-4 sm:px-6">
              <p className="text-sm font-semibold">{editingSlot ? t("editSlot") : t("addSlot")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("day")}</Label>
                  <Select value={day} onValueChange={setDay}>
                    <SelectTrigger aria-label={t("day")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 0, 1, 2, 3, 4, 5].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {weekdayName(d, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slot-time">{t("time")}</Label>
                  <Input id="slot-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slot-duration">{t("duration")}</Label>
                  <Input
                    id="slot-duration"
                    type="number"
                    min={15}
                    max={600}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slot-location">{t("location")}</Label>
                  <Input
                    id="slot-location"
                    value={slotLocation}
                    maxLength={300}
                    placeholder={group?.location ?? ""}
                    onChange={(e) => setSlotLocation(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={savingSlot} className="gap-2">
                  {savingSlot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {editingSlot ? tc("save") : t("addSlot")}
                </Button>
                {editingSlot && (
                  <Button type="button" variant="outline" onClick={resetSlotForm}>
                    {tc("cancel")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("timezoneNote")}</p>
            </form>
          </SectionCard>

          <SectionCard icon={CalendarClock} title={t("generateTitle")} description={t("generateHint")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label>{t("weeks")}</Label>
                <Select value={weeks} onValueChange={setWeeks}>
                  <SelectTrigger aria-label={t("weeks")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_OPTIONS.map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        {t("weeksOption", { count: w })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generate} disabled={generating || !slots?.length} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                {t("generate")}
              </Button>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          className="lg:col-span-3"
          icon={CalendarDays}
          title={t("upcomingTitle")}
          description={sessions ? t("upcomingCount", { count: sessions.filter((s) => !s.cancelled).length }) : undefined}
          contentClassName="p-0"
        >
          {sessions === null ? (
            <div className="p-4">
              <ListSkeleton rows={4} />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState variant="plain" icon={CalendarDays} title={t("noUpcoming")} description={t("noUpcomingHint")} />
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={s.cancelled ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                        {fmt.date.format(new Date(s.startsAt))} · {fmt.time.format(new Date(s.startsAt))}
                      </p>
                      {s.cancelled && <StatusBadge status="CANCELLED" label={t("cancelled")} />}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {s.title && <span>{s.title}</span>}
                      {s.mode === "ONLINE" ? (
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3 w-3" aria-hidden="true" />
                          {t("online")}
                        </span>
                      ) : (
                        s.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {s.location}
                          </span>
                        )
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {s.cancelled ? (
                      <Button variant="outline" size="sm" onClick={() => restoreSession(s)}>
                        {t("restore")}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={tc("edit")}
                          onClick={() => {
                            setEditingSession(s)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={t("cancelSession")}
                          onClick={() => setCancelTarget(s)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SessionDialog
        groupId={groupId}
        session={editingSession}
        defaultMode={group?.mode ?? "OFFLINE"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => loadSessions().catch(() => undefined)}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancelDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("cancelSession")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
