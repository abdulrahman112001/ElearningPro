"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cairoInputParts, cairoToday, fetchJson } from "./time"

export interface EditableSession {
  id: string
  title: string | null
  startsAt: string
  endsAt: string | null
  mode: string
  location: string | null
  notes?: string | null
}

/** Create or edit a one-off session (date/time are Cairo wall-clock). */
export function SessionDialog({
  groupId,
  session,
  defaultMode,
  open,
  onOpenChange,
  onSaved,
}: {
  groupId: string
  session: EditableSession | null
  defaultMode: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations("attendance.sessionForm")
  const tc = useTranslations("common")
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("17:00")
  const [duration, setDuration] = React.useState("60")
  const [title, setTitle] = React.useState("")
  const [mode, setMode] = React.useState("OFFLINE")
  const [location, setLocation] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (session) {
      const p = cairoInputParts(session.startsAt)
      setDate(p.date)
      setTime(p.time)
      setDuration(
        String(session.endsAt ? Math.round((+new Date(session.endsAt) - +new Date(session.startsAt)) / 60000) : 60)
      )
      setTitle(session.title ?? "")
      setMode(session.mode === "ONLINE" ? "ONLINE" : "OFFLINE")
      setLocation(session.location ?? "")
      setNotes(session.notes ?? "")
    } else {
      setDate(cairoToday())
      setTime("17:00")
      setDuration("60")
      setTitle("")
      setMode(defaultMode === "ONLINE" ? "ONLINE" : "OFFLINE")
      setLocation("")
      setNotes("")
    }
  }, [open, session, defaultMode])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const durationMin = Number(duration)
    if (!date || !time || !Number.isInteger(durationMin) || durationMin < 15 || durationMin > 600) {
      toast.error(t("invalid"))
      return
    }
    setSaving(true)
    try {
      const body = {
        date,
        time,
        durationMin,
        title: title.trim() || null,
        mode,
        ...(location.trim() || session ? { location: location.trim() || null } : {}),
        notes: notes.trim() || null,
      }
      await fetchJson(
        session ? `/api/instructor/groups/${groupId}/sessions/${session.id}` : `/api/instructor/groups/${groupId}/sessions`,
        { method: session ? "PATCH" : "POST", json: body }
      )
      toast.success(session ? t("updated") : t("created"))
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      toast.error(err?.code === "duplicate_session" ? t("duplicate") : t("failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{session ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("timezoneHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-title">{t("title")}</Label>
            <Input
              id="session-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-date">{t("date")}</Label>
              <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-time">{t("time")}</Label>
              <Input id="session-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-duration">{t("duration")}</Label>
              <Input
                id="session-duration"
                type="number"
                min={15}
                max={600}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("mode")}</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger aria-label={t("mode")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFLINE">{t("modes.OFFLINE")}</SelectItem>
                  <SelectItem value="ONLINE">{t("modes.ONLINE")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {mode === "OFFLINE" && (
            <div className="space-y-2">
              <Label htmlFor="session-location">{t("location")}</Label>
              <Input
                id="session-location"
                value={location}
                maxLength={300}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("locationPlaceholder")}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="session-notes">{t("notes")}</Label>
            <Textarea id="session-notes" rows={2} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
