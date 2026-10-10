"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AlertTriangle, BookOpen, Loader2, Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardSkeleton, EmptyState, PageHeader, SectionCard } from "@/components/shared"
import { intlLocale, readError } from "./format"

export interface SchoolClass {
  id: string
  name: string
  instructor: { id: string; name: string | null }
  _count: { members: number }
  subjects: { id: string; subject: string; teacher: { id: string; name: string | null; image: string | null } }[]
}
export interface SchoolTeacher {
  id: string
  name: string | null
  email: string | null
  role: string
}
export interface SchoolData {
  organization: { id: string; name: string; logoUrl: string | null }
  canManage: boolean
  classes: SchoolClass[]
  teachers: SchoolTeacher[]
  terms: { id: string; name: string; startsAt: string; endsAt: string; isCurrent: boolean }[]
}

/** Loads /api/school/:orgId/classes. */
export function useSchoolData(orgId: string) {
  const [data, setData] = React.useState<SchoolData | null>(null)
  const [error, setError] = React.useState(false)
  const load = React.useCallback(() => {
    fetch(`/api/school/${orgId}/classes`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        setData(await r.json())
      })
      .catch(() => setError(true))
  }, [orgId])
  React.useEffect(load, [load])
  return { data, error, reload: load }
}

export function SubjectsManager({ orgId }: { orgId: string }) {
  const t = useTranslations("school")
  const { data, error, reload } = useSchoolData(orgId)

  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title={t("subjects.title")} description={t("subjects.subtitle")} />
      {error ? (
        <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
      ) : !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : data.classes.length === 0 ? (
        <EmptyState icon={Users} title={t("noClasses")} description={t("noClassesHint")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.classes.map((c) => (
            <ClassSubjectsCard key={c.id} orgId={orgId} cls={c} teachers={data.teachers} canManage={data.canManage} onChange={reload} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClassSubjectsCard({
  orgId,
  cls,
  teachers,
  canManage,
  onChange,
}: {
  orgId: string
  cls: SchoolClass
  teachers: SchoolTeacher[]
  canManage: boolean
  onChange: () => void
}) {
  const t = useTranslations("school")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(intlLocale(locale))
  const [subject, setSubject] = React.useState("")
  const [teacherId, setTeacherId] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const api = `/api/school/${orgId}/subjects`

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !teacherId) return toast.error(t("errors.required"))
    setSaving(true)
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: cls.id, subject, teacherId }),
      })
      if (!res.ok) {
        const err = await readError(res)
        return toast.error(err.code === "duplicate_subject" ? t("subjects.duplicate") : t("errors.saveFailed"))
      }
      setSubject("")
      toast.success(t("subjects.added"))
      onChange()
    } finally {
      setSaving(false)
    }
  }

  async function changeTeacher(id: string, newTeacher: string) {
    const res = await fetch(`${api}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: newTeacher }),
    })
    if (!res.ok) return toast.error(t("errors.saveFailed"))
    toast.success(t("subjects.updated"))
    onChange()
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(t("subjects.confirmRemove", { subject: name }))) return
    const res = await fetch(`${api}/${id}`, { method: "DELETE" })
    if (!res.ok) return toast.error(t("errors.deleteFailed"))
    onChange()
  }

  return (
    <SectionCard
      icon={Users}
      title={cls.name}
      description={t("subjects.classMeta", { students: nf.format(cls._count.members), teacher: cls.instructor.name ?? "—" })}
      contentClassName="p-0"
    >
      {cls.subjects.length === 0 ? (
        <EmptyState variant="plain" size="sm" icon={BookOpen} title={t("subjects.empty")} />
      ) : (
        <ul className="divide-y">
          {cls.subjects.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
              <span className="min-w-0 break-words font-medium">{s.subject}</span>
              <div className="flex items-center gap-1">
                {canManage ? (
                  <>
                    <Select value={s.teacher.id} onValueChange={(v) => changeTeacher(s.id, v)}>
                      <SelectTrigger className="h-8 w-44" aria-label={t("subjects.teacher")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((tt) => (
                          <SelectItem key={tt.id} value={tt.id}>
                            {tt.name ?? tt.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(s.id, s.subject)} aria-label={t("subjects.remove")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{s.teacher.name}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={add} className="grid gap-2 border-t bg-muted/20 p-4 sm:grid-cols-[1fr_1fr_auto] sm:px-6">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("subjects.subjectPlaceholder")} maxLength={80} aria-label={t("subjects.subject")} />
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger aria-label={t("subjects.teacher")}>
              <SelectValue placeholder={t("subjects.pickTeacher")} />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((tt) => (
                <SelectItem key={tt.id} value={tt.id}>
                  {tt.name ?? tt.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ms-1.5">{t("subjects.add")}</span>
          </Button>
        </form>
      )}
    </SectionCard>
  )
}
