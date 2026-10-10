"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AlertTriangle, Loader2, Megaphone, Pin, PinOff, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AvatarName, EmptyState, ListSkeleton, PageHeader, SectionCard } from "@/components/shared"
import { Pill } from "@/components/homework/pill"
import { intlLocale } from "./format"
import { useSchoolData } from "./subjects-manager"

const ORG = "__org__"
const AUDIENCES = ["ALL", "STUDENTS", "PARENTS", "TEACHERS"] as const

interface Announcement {
  id: string
  title: string
  body: string
  audience: (typeof AUDIENCES)[number]
  pinned: boolean
  createdAt: string
  author: { id: string; name: string | null; image: string | null }
  group: { id: string; name: string } | null
}

export function AnnouncementsManager({ orgId, userId }: { orgId: string; userId: string }) {
  const t = useTranslations("school")
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" })
  const { data } = useSchoolData(orgId)
  const [rows, setRows] = React.useState<Announcement[] | null>(null)
  const [error, setError] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [target, setTarget] = React.useState(ORG)
  const [audience, setAudience] = React.useState<(typeof AUDIENCES)[number]>("ALL")
  const [pinned, setPinned] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const api = `/api/school/${orgId}/announcements`
  const canManage = !!data?.canManage

  React.useEffect(() => {
    if (data && !data.canManage && target === ORG && data.classes[0]) setTarget(data.classes[0].id)
  }, [data, target])

  const load = React.useCallback(() => {
    fetch(api)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        setRows(await r.json())
      })
      .catch(() => setError(true))
  }, [api])
  React.useEffect(load, [load])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return toast.error(t("errors.required"))
    setSaving(true)
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience, pinned, groupId: target === ORG ? null : target }),
      })
      if (!res.ok) return toast.error(res.status === 403 ? t("announcements.forbidden") : t("errors.saveFailed"))
      const saved = await res.json()
      toast.success(t("announcements.posted", { count: saved.notified ?? 0 }))
      setTitle("")
      setBody("")
      setPinned(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function togglePin(a: Announcement) {
    const res = await fetch(`${api}/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !a.pinned }),
    })
    if (!res.ok) return toast.error(t("errors.saveFailed"))
    load()
  }

  async function remove(a: Announcement) {
    if (!window.confirm(t("announcements.confirmDelete"))) return
    const res = await fetch(`${api}/${a.id}`, { method: "DELETE" })
    if (!res.ok) return toast.error(t("errors.deleteFailed"))
    load()
  }

  const classes = data?.classes ?? []

  return (
    <div className="space-y-6">
      <PageHeader icon={Megaphone} title={t("announcements.title")} description={t("announcements.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <SectionCard icon={Send} title={t("announcements.new")} className="h-fit">
          {data && !canManage && classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("announcements.teacherNoClasses")}</p>
          ) : (
            <form onSubmit={post} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="an-title">{t("announcements.titleLabel")}</Label>
                <Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="an-body">{t("announcements.body")}</Label>
                <Textarea id="an-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("announcements.target")}</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canManage && <SelectItem value={ORG}>{t("announcements.wholeSchool")}</SelectItem>}
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("announcements.audience")}</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(`announcements.audiences.${a}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canManage && (
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <Label htmlFor="an-pin">{t("announcements.pin")}</Label>
                  <Switch id="an-pin" checked={pinned} onCheckedChange={setPinned} />
                </div>
              )}
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4 rtl:-scale-x-100" />}
                {t("announcements.post")}
              </Button>
            </form>
          )}
        </SectionCard>

        <div className="min-w-0">
          {error ? (
            <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
          ) : !rows ? (
            <ListSkeleton rows={3} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Megaphone} title={t("announcements.empty")} />
          ) : (
            <ul className="space-y-4">
              {rows.map((a) => (
                <li key={a.id} className="rounded-lg border bg-card p-4 shadow-soft sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 break-words font-semibold">
                        {a.pinned && <Pin className="h-4 w-4 shrink-0 text-primary" aria-label={t("announcements.pinned")} />}
                        {a.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Pill tone="neutral">{a.group?.name ?? t("announcements.wholeSchool")}</Pill>
                        <Pill tone="info">{t(`announcements.audiences.${a.audience}`)}</Pill>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {canManage && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => togglePin(a)} aria-label={a.pinned ? t("announcements.unpin") : t("announcements.pin")}>
                          {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </Button>
                      )}
                      {(canManage || a.author.id === userId) && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(a)} aria-label={t("announcements.delete")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{a.body}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <AvatarName name={a.author.name} image={a.author.image} size="sm" />
                    <time className="text-xs text-muted-foreground">{dateFmt.format(new Date(a.createdAt))}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
