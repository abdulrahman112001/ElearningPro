"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Pencil, Plus, Trash2, UserMinus, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared"
import { ClassCard, type ClassCardData } from "./class-card"

const NONE = "__none__"

export interface OrgClassRow extends ClassCardData {
  description: string | null
  instructorId: string
  gradeLevelId: string | null
  students: { id: string; name: string | null; email: string }[]
}

interface Option {
  id: string
  label: string
}

interface FormState {
  id?: string
  name: string
  description: string
  gradeLevelId: string
  instructorId: string
  mode: string
  location: string
  monthlyFee: string
  capacity: string
}

const EMPTY: FormState = {
  name: "", description: "", gradeLevelId: NONE, instructorId: "", mode: "ONLINE",
  location: "", monthlyFee: "0", capacity: "",
}

export function ClassesManager({
  orgId,
  classes,
  teachers,
  students,
  grades,
  canManage,
  viewerId,
}: {
  orgId: string
  classes: OrgClassRow[]
  teachers: Option[]
  students: Option[]
  grades: Option[]
  canManage: boolean
  viewerId: string
}) {
  const t = useTranslations("organizations")
  const locale = useLocale()
  const router = useRouter()
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [pick, setPick] = React.useState<Record<string, string>>({})

  const errorText = (data: { code?: string; error?: string }) =>
    data.code ? t(`errors.${data.code}`) : data.error || t("errors.generic")

  const request = async (key: string, url: string, init: RequestInit, ok: string) => {
    setBusy(key)
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(errorText(data))
        return false
      }
      toast.success(ok)
      router.refresh()
      return true
    } catch {
      toast.error(t("errors.generic"))
      return false
    } finally {
      setBusy(null)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    if (!form.name.trim()) return toast.error(t("classes.nameRequired"))
    if (!form.instructorId) return toast.error(t("errors.teacher_required"))
    setSaving(true)
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      gradeLevelId: form.gradeLevelId === NONE ? null : form.gradeLevelId,
      instructorId: form.instructorId,
      mode: form.mode,
      location: form.location.trim() || null,
      monthlyFee: Number(form.monthlyFee || 0),
      capacity: form.capacity ? Number(form.capacity) : null,
    }
    const ok = await request(
      "save",
      form.id ? `/api/organizations/${orgId}/classes/${form.id}` : `/api/organizations/${orgId}/classes`,
      { method: form.id ? "PATCH" : "POST", body: JSON.stringify(body) },
      form.id ? t("classes.saved") : t("classes.created")
    )
    setSaving(false)
    if (ok) setForm(null)
  }

  const set = (k: keyof FormState, v: string) => setForm((p) => (p ? { ...p, [k]: v } : p))

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setForm({ ...EMPTY, instructorId: teachers[0]?.id ?? "" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("classes.new")}
          </Button>
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState icon={UsersRound} title={t("classes.empty")} description={canManage ? t("classes.emptyHint") : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const mayEditStudents = canManage || c.instructorId === viewerId
            const inClass = new Set(c.students.map((s) => s.id))
            const candidates = students.filter((s) => !inClass.has(s.id))
            const full = c.capacity != null && c.students.length >= c.capacity
            return (
              <ClassCard key={c.id} group={c} locale={locale} showManageLinks={mayEditStudents}>
                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        setForm({
                          id: c.id,
                          name: c.name,
                          description: c.description ?? "",
                          gradeLevelId: c.gradeLevelId ?? NONE,
                          instructorId: c.instructorId,
                          mode: c.mode,
                          location: c.location ?? "",
                          monthlyFee: String(c.monthlyFee),
                          capacity: c.capacity ? String(c.capacity) : "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("classes.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive"
                      disabled={busy === `del-${c.id}`}
                      onClick={() => {
                        if (confirm(t("classes.deleteConfirm", { name: c.name }))) {
                          request(`del-${c.id}`, `/api/organizations/${orgId}/classes/${c.id}`, { method: "DELETE" }, t("classes.deleted"))
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("classes.delete")}
                    </Button>
                  </div>
                )}
                <details className="rounded-md border p-2 text-sm">
                  <summary className="cursor-pointer font-medium">{t("classes.studentsList", { count: c.students.length })}</summary>
                  <ul className="mt-2 space-y-1">
                    {c.students.map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{s.name || s.email}</span>
                        {mayEditStudents && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            aria-label={t("classes.removeStudent")}
                            disabled={busy === `${c.id}-${s.id}`}
                            onClick={() =>
                              request(`${c.id}-${s.id}`, `/api/organizations/${orgId}/classes/${c.id}/students/${s.id}`, { method: "DELETE" }, t("classes.studentRemoved"))
                            }
                          >
                            <UserMinus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {mayEditStudents && (
                    full ? (
                      <p className="mt-2 text-xs text-muted-foreground">{t("errors.class_full")}</p>
                    ) : candidates.length > 0 ? (
                      <div className="mt-2 flex gap-2">
                        <Select value={pick[c.id] ?? ""} onValueChange={(v) => setPick((p) => ({ ...p, [c.id]: v }))}>
                          <SelectTrigger className="h-8 min-w-0 flex-1" aria-label={t("classes.addStudent")}>
                            <SelectValue placeholder={t("classes.chooseStudent")} />
                          </SelectTrigger>
                          <SelectContent>
                            {candidates.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!pick[c.id] || busy === `add-${c.id}`}
                          onClick={async () => {
                            const ok = await request(`add-${c.id}`, `/api/organizations/${orgId}/classes/${c.id}/students`, {
                              method: "POST",
                              body: JSON.stringify({ userId: pick[c.id] }),
                            }, t("classes.studentAdded"))
                            if (ok) setPick((p) => ({ ...p, [c.id]: "" }))
                          }}
                        >
                          {t("members.add")}
                        </Button>
                      </div>
                    ) : null
                  )}
                </details>
              </ClassCard>
            )
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? t("classes.edit") : t("classes.new")}</DialogTitle>
          </DialogHeader>
          {form && (
            <form id="class-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-name">{t("classes.name")}</Label>
                <Input id="c-name" required maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-teacher">{t("classes.teacher")}</Label>
                <Select value={form.instructorId} onValueChange={(v) => set("instructorId", v)}>
                  <SelectTrigger id="c-teacher"><SelectValue placeholder={t("classes.chooseTeacher")} /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((x) => (
                      <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {teachers.length === 0 && <p className="text-xs text-muted-foreground">{t("classes.noTeachers")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-grade">{t("classes.grade")}</Label>
                <Select value={form.gradeLevelId} onValueChange={(v) => set("gradeLevelId", v)}>
                  <SelectTrigger id="c-grade"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("classes.noGrade")}</SelectItem>
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-mode">{t("classes.mode")}</Label>
                <Select value={form.mode} onValueChange={(v) => set("mode", v)}>
                  <SelectTrigger id="c-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["ONLINE", "OFFLINE", "HYBRID"].map((m) => (
                      <SelectItem key={m} value={m}>{t(`modes.${m}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-location">{t("classes.location")}</Label>
                <Input id="c-location" maxLength={200} value={form.location} onChange={(e) => set("location", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-fee">{t("classes.monthlyFee")}</Label>
                <Input id="c-fee" type="number" min={0} step="0.01" dir="ltr" value={form.monthlyFee} onChange={(e) => set("monthlyFee", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-capacity">{t("classes.capacity")}</Label>
                <Input id="c-capacity" type="number" min={1} step={1} dir="ltr" placeholder={t("classes.unlimited")} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-desc">{t("classes.description")}</Label>
                <Textarea id="c-desc" rows={3} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
            </form>
          )}
          <DialogFooter>
            <Button type="submit" form="class-form" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("form.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
