"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AlertTriangle, CalendarRange, CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, ListSkeleton, PageHeader, SectionCard } from "@/components/shared"
import { Pill } from "@/components/homework/pill"
import { intlLocale, readError, toDateInput } from "./format"

interface Term {
  id: string
  name: string
  startsAt: string
  endsAt: string
  isCurrent: boolean
  _count: { gradeEntries: number }
}

export function TermsManager({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const t = useTranslations("school")
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" })
  const nf = new Intl.NumberFormat(intlLocale(locale))
  const [terms, setTerms] = React.useState<Term[] | null>(null)
  const [error, setError] = React.useState(false)
  const [editing, setEditing] = React.useState<Term | "new" | null>(null)
  const api = `/api/school/${orgId}/terms`

  const load = React.useCallback(() => {
    fetch(api)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        setTerms(await r.json())
      })
      .catch(() => setError(true))
  }, [api])
  React.useEffect(load, [load])

  async function makeCurrent(term: Term) {
    const res = await fetch(`${api}/${term.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCurrent: true }),
    })
    if (!res.ok) return toast.error(t("errors.saveFailed"))
    toast.success(t("terms.nowCurrent", { name: term.name }))
    load()
  }

  async function remove(term: Term) {
    if (!window.confirm(t("terms.confirmDelete", { name: term.name }))) return
    const res = await fetch(`${api}/${term.id}`, { method: "DELETE" })
    if (!res.ok) return toast.error(t("errors.deleteFailed"))
    toast.success(t("terms.deleted"))
    load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarRange}
        title={t("terms.title")}
        description={t("terms.subtitle")}
        actions={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="me-2 h-4 w-4" />
              {t("terms.add")}
            </Button>
          )
        }
      />
      {error ? (
        <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
      ) : !terms ? (
        <ListSkeleton rows={3} />
      ) : terms.length === 0 ? (
        <EmptyState icon={CalendarRange} title={t("terms.empty")} description={t("terms.emptyHint")} />
      ) : (
        <SectionCard contentClassName="p-0">
          <ul className="divide-y">
            {terms.map((term) => (
              <li key={term.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {term.name}
                    {term.isCurrent && <Pill tone="success">{t("terms.current")}</Pill>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateFmt.format(new Date(term.startsAt))} – {dateFmt.format(new Date(term.endsAt))} ·{" "}
                    {t("terms.marks", { count: term._count.gradeEntries, formatted: nf.format(term._count.gradeEntries) })}
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-1">
                    {!term.isCurrent && (
                      <Button size="sm" variant="outline" onClick={() => makeCurrent(term)}>
                        <CheckCircle2 className="me-1.5 h-4 w-4" />
                        {t("terms.makeCurrent")}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => setEditing(term)} aria-label={t("terms.edit")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(term)} aria-label={t("terms.delete")} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      <TermDialog
        api={api}
        term={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={load}
      />
    </div>
  )
}

function TermDialog({
  api,
  term,
  open,
  onOpenChange,
  onSaved,
}: {
  api: string
  term: Term | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations("school")
  const [name, setName] = React.useState("")
  const [startsAt, setStartsAt] = React.useState("")
  const [endsAt, setEndsAt] = React.useState("")
  const [isCurrent, setIsCurrent] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setName(term?.name ?? "")
    setStartsAt(toDateInput(term?.startsAt))
    setEndsAt(toDateInput(term?.endsAt))
    setIsCurrent(term?.isCurrent ?? false)
    setError(null)
  }, [open, term])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !startsAt || !endsAt) return setError(t("errors.required"))
    if (endsAt <= startsAt) return setError(t("terms.endBeforeStart"))
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name,
        startsAt: new Date(`${startsAt}T00:00:00`).toISOString(),
        endsAt: new Date(`${endsAt}T23:59:59`).toISOString(),
      }
      if (isCurrent) body.isCurrent = true
      const res = await fetch(term ? `${api}/${term.id}` : api, {
        method: term ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await readError(res)
        setError(err.code === "end_before_start" ? t("terms.endBeforeStart") : t("errors.saveFailed"))
        return
      }
      toast.success(t("terms.saved"))
      onOpenChange(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{term ? t("terms.edit") : t("terms.add")}</DialogTitle>
          <DialogDescription>{t("terms.dialogHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="term-name">{t("terms.name")}</Label>
            <Input id="term-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t("terms.namePlaceholder")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="term-start">{t("terms.startsAt")}</Label>
              <Input id="term-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term-end">{t("terms.endsAt")}</Label>
              <Input id="term-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          {!(term?.isCurrent) && (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="term-current">{t("terms.setCurrent")}</Label>
              <Switch id="term-current" checked={isCurrent} onCheckedChange={setIsCurrent} />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
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
