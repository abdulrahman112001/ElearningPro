"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AlertTriangle, CalendarDays, Loader2, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CardSkeleton, EmptyState, PageHeader } from "@/components/shared"
import { WeekTimetable, type TimetableItem } from "./week-timetable"
import { dayName, formatClock, readError, schoolDays } from "./format"
import { useSchoolData, type SchoolClass, type SchoolTeacher } from "./subjects-manager"

const AUTO = "__auto__"
const NONE = "__none__"

interface Conflict {
  type: "teacher" | "class"
  groupName: string
  subject: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

type Entry = TimetableItem & { teacherId: string | null; groupId: string }

export function TimetableEditor({ orgId }: { orgId: string }) {
  const t = useTranslations("school")
  const { data, error } = useSchoolData(orgId)
  const [groupId, setGroupId] = React.useState("")
  const [entries, setEntries] = React.useState<Entry[] | null>(null)
  const [saturday, setSaturday] = React.useState(false)
  const [editing, setEditing] = React.useState<Entry | { dayOfWeek: number } | null>(null)

  React.useEffect(() => {
    if (data && !groupId && data.classes[0]) setGroupId(data.classes[0].id)
  }, [data, groupId])

  const load = React.useCallback(() => {
    if (!groupId) return
    fetch(`/api/school/${orgId}/timetable?groupId=${groupId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [orgId, groupId])
  React.useEffect(load, [load])

  async function remove(e: TimetableItem) {
    if (!window.confirm(t("timetable.confirmDelete", { subject: e.subject }))) return
    const res = await fetch(`/api/school/${orgId}/timetable/${e.id}`, { method: "DELETE" })
    if (!res.ok) return toast.error(t("errors.deleteFailed"))
    load()
  }

  const cls = data?.classes.find((c) => c.id === groupId)
  const canManage = !!data?.canManage

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        title={t("timetable.title")}
        description={t("timetable.subtitle")}
        actions={
          canManage &&
          cls && (
            <Button onClick={() => setEditing({ dayOfWeek: 0 })}>
              <Plus className="me-2 h-4 w-4" />
              {t("timetable.add")}
            </Button>
          )
        }
      >
        {data && data.classes.length > 0 && (
          <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-soft sm:grid-cols-2 sm:p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("timetable.class")}</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:mt-5">
              <Label htmlFor="tt-sat" className="text-sm">
                {t("timetable.showSaturday")}
              </Label>
              <Switch id="tt-sat" checked={saturday} onCheckedChange={setSaturday} />
            </div>
          </div>
        )}
      </PageHeader>

      {error ? (
        <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
      ) : !data ? (
        <CardSkeleton />
      ) : data.classes.length === 0 ? (
        <EmptyState icon={Users} title={t("noClasses")} description={t("noClassesHint")} />
      ) : !entries ? (
        <CardSkeleton />
      ) : (
        <WeekTimetable
          entries={entries}
          days={schoolDays(saturday, entries)}
          show={{ group: false, teacher: true }}
          highlightToday={false}
          onEdit={canManage ? (e) => setEditing(e as Entry) : undefined}
          onDelete={canManage ? remove : undefined}
        />
      )}

      {cls && data && (
        <EntryDialog
          orgId={orgId}
          cls={cls}
          teachers={data.teachers}
          days={schoolDays(true, entries ?? [])}
          entry={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function EntryDialog({
  orgId,
  cls,
  teachers,
  days,
  entry,
  onOpenChange,
  onSaved,
}: {
  orgId: string
  cls: SchoolClass
  teachers: SchoolTeacher[]
  days: number[]
  entry: Entry | { dayOfWeek: number } | null
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations("school")
  const locale = useLocale()
  const existing = entry && "id" in entry ? entry : null
  const [day, setDay] = React.useState("0")
  const [start, setStart] = React.useState("08:00")
  const [end, setEnd] = React.useState("08:45")
  const [subject, setSubject] = React.useState("")
  const [teacher, setTeacher] = React.useState(AUTO)
  const [room, setRoom] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [conflicts, setConflicts] = React.useState<Conflict[]>([])

  React.useEffect(() => {
    if (!entry) return
    setDay(String(entry.dayOfWeek))
    setStart(existing?.startTime ?? "08:00")
    setEnd(existing?.endTime ?? "08:45")
    setSubject(existing?.subject ?? cls.subjects[0]?.subject ?? "")
    setTeacher(existing ? existing.teacherId ?? NONE : AUTO)
    setRoom(existing?.room ?? "")
    setError(null)
    setConflicts([])
  }, [entry, existing, cls])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setConflicts([])
    if (!subject.trim() || !start || !end) return setError(t("errors.required"))
    if (end <= start) return setError(t("timetable.endBeforeStart"))
    setSaving(true)
    const body: Record<string, unknown> = { subject, dayOfWeek: Number(day), startTime: start, endTime: end, room: room || null }
    if (teacher === NONE) body.teacherId = null
    else if (teacher !== AUTO) body.teacherId = teacher
    if (!existing) body.groupId = cls.id
    try {
      const res = await fetch(existing ? `/api/school/${orgId}/timetable/${existing.id}` : `/api/school/${orgId}/timetable`, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await readError(res)
        if (err.code === "timetable_conflict") {
          setConflicts(err.conflicts ?? [])
          setError(t("timetable.conflict"))
        } else setError(err.code === "end_before_start" ? t("timetable.endBeforeStart") : t("errors.saveFailed"))
        return
      }
      toast.success(t("timetable.saved"))
      onOpenChange(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? t("timetable.edit") : t("timetable.add")}</DialogTitle>
          <DialogDescription>{cls.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="tt-day">{t("timetable.day")}</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger id="tt-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {dayName(locale, d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tt-start">{t("timetable.start")}</Label>
              <Input id="tt-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-end">{t("timetable.end")}</Label>
              <Input id="tt-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-subject">{t("timetable.subject")}</Label>
            <Input id="tt-subject" list="tt-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} />
            <datalist id="tt-subjects">
              {cls.subjects.map((s) => (
                <option key={s.id} value={s.subject} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-teacher">{t("timetable.teacher")}</Label>
            <Select value={teacher} onValueChange={setTeacher}>
              <SelectTrigger id="tt-teacher">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!existing && <SelectItem value={AUTO}>{t("timetable.teacherAuto")}</SelectItem>}
                <SelectItem value={NONE}>{t("timetable.teacherNone")}</SelectItem>
                {teachers.map((tt) => (
                  <SelectItem key={tt.id} value={tt.id}>
                    {tt.name ?? tt.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-room">{t("timetable.room")}</Label>
            <Input id="tt-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} />
          </div>
          {error && (
            <div role="alert" className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">{error}</p>
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs">
                  {t(c.type === "teacher" ? "timetable.conflictTeacher" : "timetable.conflictClass", {
                    subject: c.subject,
                    group: c.groupName,
                    day: dayName(locale, c.dayOfWeek),
                    time: `${formatClock(locale, c.startTime)} – ${formatClock(locale, c.endTime)}`,
                  })}
                </p>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
