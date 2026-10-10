"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AlertTriangle, BookMarked, Download, Loader2, Plus, Save, Trash2, Users } from "lucide-react"
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
import { AvatarName, EmptyState, PageHeader, SectionCard, TableSkeleton, scoreTone, toneStyles } from "@/components/shared"
import { intlLocale, readError } from "@/components/school/format"
import { cn } from "@/lib/utils"

const NO_TERM = "none"

interface Column {
  key: string
  kind: "grade" | "homework"
  subject: string
  title: string
  maxScore: number
  weight: number
  assignmentId?: string
}

interface Grid {
  group: { id: string; name: string; organization: { name: string } | null }
  terms: { id: string; name: string; isCurrent: boolean }[]
  term: { id: string; name: string } | null
  access: { full: boolean; subjects: string[] }
  students: { id: string; name: string | null; email: string | null; image: string | null; average: number | null }[]
  columns: Column[]
  cells: Record<string, Record<string, number>>
}

const cellId = (studentId: string, key: string) => `${studentId}|${key}`

export default function GradebookPage() {
  const t = useTranslations("gradebook")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 })
  const [groups, setGroups] = React.useState<{ id: string; name: string; organization: { name: string } | null }[] | null>(null)
  const [groupId, setGroupId] = React.useState("")
  const [termId, setTermId] = React.useState("")
  const [includeHomework, setIncludeHomework] = React.useState(false)
  const [grid, setGrid] = React.useState<Grid | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [extraColumns, setExtraColumns] = React.useState<Column[]>([])
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [addOpen, setAddOpen] = React.useState(false)

  React.useEffect(() => {
    fetch("/api/gradebook/groups")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        setGroups(list)
        if (list[0]) setGroupId(list[0].id)
      })
      .catch(() => setGroups([]))
  }, [])

  const load = React.useCallback(() => {
    if (!groupId) return
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams()
    if (termId) qs.set("termId", termId)
    if (includeHomework) qs.set("includeHomework", "1")
    fetch(`/api/gradebook/${groupId}?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const g: Grid = await r.json()
        setGrid(g)
        setDraft({})
        setExtraColumns([])
        if (!termId && g.term) setTermId(g.term.id)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [groupId, termId, includeHomework])
  React.useEffect(load, [load])

  const columns = React.useMemo(() => [...(grid?.columns ?? []), ...extraColumns], [grid, extraColumns])
  const dirtyCount = Object.keys(draft).length

  const valueOf = (studentId: string, col: Column) => {
    const id = cellId(studentId, col.key)
    if (id in draft) return draft[id]
    const v = grid?.cells[studentId]?.[col.key]
    return v === undefined ? "" : String(v)
  }
  const isInvalid = (raw: string, col: Column) => {
    if (raw.trim() === "") return false
    const n = Number(raw)
    return !Number.isFinite(n) || n < 0 || n > col.maxScore
  }

  /** Live weighted average including unsaved edits. */
  const averageOf = (studentId: string) => {
    let num = 0
    let den = 0
    for (const c of columns) {
      const raw = valueOf(studentId, c)
      if (raw.trim() === "" || isInvalid(raw, c)) continue
      num += (c.weight * Number(raw)) / c.maxScore
      den += c.weight
    }
    return den ? Math.round((num / den) * 1000) / 10 : null
  }

  const invalidCells = Object.entries(draft).filter(([id, raw]) => {
    const key = id.slice(id.indexOf("|") + 1)
    const col = columns.find((c) => c.key === key)
    return col ? isInvalid(raw, col) : false
  }).length

  async function save() {
    if (!grid || dirtyCount === 0) return
    if (invalidCells > 0) return toast.error(t("errors.fixInvalid", { count: invalidCells }))
    const entries = Object.entries(draft).flatMap(([id, raw]) => {
      const sep = id.indexOf("|")
      const studentId = id.slice(0, sep)
      const col = columns.find((c) => c.key === id.slice(sep + 1))
      if (!col || col.kind !== "grade") return []
      const original = grid.cells[studentId]?.[col.key]
      if (raw.trim() === "" && original === undefined) return []
      return [{ studentId, subject: col.subject, title: col.title, maxScore: col.maxScore, weight: col.weight, score: raw.trim() === "" ? null : Number(raw) }]
    })
    if (entries.length === 0) return setDraft({})
    setSaving(true)
    try {
      const res = await fetch(`/api/gradebook/${grid.group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId: grid.term?.id ?? NO_TERM, entries }),
      })
      if (!res.ok) {
        const err = await readError(res)
        toast.error(err.code === "invalid_entries" ? t("errors.fixInvalid", { count: err.errors?.length ?? 1 }) : t("errors.saveFailed"))
        return
      }
      const result = await res.json()
      toast.success(t("saved", { count: result.saved + result.cleared }))
      load()
    } catch {
      toast.error(t("errors.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function removeColumn(col: Column) {
    if (!grid) return
    if (!window.confirm(t("confirmRemove", { title: col.title }))) return
    if (!grid.columns.some((c) => c.key === col.key)) {
      setExtraColumns((cols) => cols.filter((c) => c.key !== col.key))
      return
    }
    const qs = new URLSearchParams({ subject: col.subject, title: col.title, maxScore: String(col.maxScore), termId: grid.term?.id ?? NO_TERM })
    const res = await fetch(`/api/gradebook/${grid.group.id}?${qs}`, { method: "DELETE" })
    if (!res.ok) return toast.error(t("errors.saveFailed"))
    toast.success(t("removed"))
    load()
  }

  const exportHref = grid
    ? `/api/gradebook/${grid.group.id}?${new URLSearchParams({ format: "csv", termId: grid.term?.id ?? NO_TERM, ...(includeHomework ? { includeHomework: "1" } : {}) })}`
    : "#"

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookMarked}
        title={t("title")}
        description={t("subtitle")}
        actions={
          grid && (
            <>
              <Button variant="outline" asChild>
                <a href={exportHref} download>
                  <Download className="me-2 h-4 w-4" />
                  {t("exportCsv")}
                </a>
              </Button>
              <Button onClick={save} disabled={saving || dirtyCount === 0}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                {dirtyCount ? t("saveCount", { count: dirtyCount }) : t("save")}
              </Button>
            </>
          )
        }
      >
        <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-soft sm:grid-cols-3 sm:p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("group")}</Label>
            <Select value={groupId} onValueChange={(v) => { setGroupId(v); setTermId("") }} disabled={!groups?.length}>
              <SelectTrigger>
                <SelectValue placeholder={t("pickGroup")} />
              </SelectTrigger>
              <SelectContent>
                {(groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.organization ? `${g.name} · ${g.organization.name}` : g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {grid && grid.terms.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("term")}</Label>
              <Select value={grid.term?.id ?? NO_TERM} onValueChange={setTermId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grid.terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.isCurrent ? t("currentTerm", { name: term.name }) : term.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_TERM}>{t("noTerm")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:mt-5">
            <Label htmlFor="inc-hw" className="text-sm">
              {t("includeHomework")}
            </Label>
            <Switch id="inc-hw" checked={includeHomework} onCheckedChange={setIncludeHomework} />
          </div>
        </div>
      </PageHeader>

      {groups && groups.length === 0 ? (
        <EmptyState icon={Users} title={t("noGroups")} description={t("noGroupsHint")} />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
      ) : !grid ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (
        <SectionCard
          icon={Users}
          title={grid.group.name}
          description={t("gridHint", { students: grid.students.length, columns: columns.length })}
          contentClassName={cn("p-0 transition-opacity", loading && "pointer-events-none opacity-60")}
          action={
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="me-1.5 h-4 w-4" />
              {t("addAssessment")}
            </Button>
          }
        >
          {grid.students.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={Users} title={t("noStudents")} />
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky start-0 z-10 bg-muted px-4 py-2 text-start font-medium sm:px-6">{t("student")}</th>
                    {columns.map((c) => (
                      <th key={c.key} className="min-w-[7rem] px-2 py-2 text-start align-bottom font-medium">
                        <div className="flex items-start gap-1">
                          <div className="min-w-0">
                            {c.subject && <p className="truncate text-[11px] font-normal text-muted-foreground">{c.subject}</p>}
                            <p className="max-w-[9rem] truncate" title={c.title}>{c.title}</p>
                            <p className="text-[11px] font-normal text-muted-foreground">
                              {c.kind === "homework" ? t("homeworkColumn", { max: nf.format(c.maxScore) }) : t("columnMeta", { max: nf.format(c.maxScore), weight: nf.format(c.weight) })}
                            </p>
                          </div>
                          {c.kind === "grade" && (grid.access.full || grid.access.subjects.includes(c.subject)) && (
                            <button type="button" onClick={() => removeColumn(c)} className="ms-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={t("removeAssessment")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="min-w-[6rem] px-4 py-2 text-end font-medium sm:px-6">{t("average")}</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.students.map((s) => {
                    const avg = averageOf(s.id)
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="sticky start-0 z-10 max-w-[11rem] bg-card px-4 py-2 sm:max-w-[16rem] sm:px-6">
                          <AvatarName name={s.name} image={s.image} size="sm" />
                        </td>
                        {columns.map((c) => {
                          const raw = valueOf(s.id, c)
                          const invalid = isInvalid(raw, c)
                          const dirty = cellId(s.id, c.key) in draft
                          return (
                            <td key={c.key} className="px-2 py-1.5">
                              {c.kind === "homework" ? (
                                <span className="tabular-nums text-muted-foreground">{raw === "" ? "—" : nf.format(Number(raw))}</span>
                              ) : (
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  min={0}
                                  max={c.maxScore}
                                  value={raw}
                                  onChange={(e) => setDraft((d) => ({ ...d, [cellId(s.id, c.key)]: e.target.value }))}
                                  className={cn("h-8 w-20 tabular-nums", dirty && "border-primary", invalid && "border-destructive focus-visible:ring-destructive")}
                                  aria-label={`${s.name ?? ""} – ${c.title}`}
                                  aria-invalid={invalid}
                                />
                              )}
                            </td>
                          )
                        })}
                        <td className={cn("px-4 py-2 text-end font-semibold tabular-nums sm:px-6", avg !== null && toneStyles[scoreTone(avg)].text)}>
                          {avg === null ? "—" : `${nf.format(avg)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {grid && (
        <AddAssessmentDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          subjects={grid.access.full ? null : grid.access.subjects}
          existing={columns}
          onAdd={(col) => setExtraColumns((cols) => [...cols, col])}
        />
      )}
    </div>
  )
}

function AddAssessmentDialog({
  open,
  onOpenChange,
  subjects,
  existing,
  onAdd,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  subjects: string[] | null
  existing: Column[]
  onAdd: (c: Column) => void
}) {
  const t = useTranslations("gradebook")
  const [subject, setSubject] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [maxScore, setMaxScore] = React.useState("20")
  const [weight, setWeight] = React.useState("1")
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setSubject(subjects?.[0] ?? "")
      setTitle("")
      setError(null)
    }
  }, [open, subjects])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const max = Number(maxScore)
    const w = Number(weight)
    if (!subject.trim() || !title.trim()) return setError(t("errors.required"))
    if (!Number.isFinite(max) || max <= 0 || max > 1000) return setError(t("errors.maxScore"))
    if (!Number.isFinite(w) || w <= 0 || w > 100) return setError(t("errors.weight"))
    const key = JSON.stringify([subject.trim(), title.trim(), max])
    if (existing.some((c) => c.key === key)) return setError(t("errors.duplicate"))
    onAdd({ key, kind: "grade", subject: subject.trim(), title: title.trim(), maxScore: max, weight: w })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addAssessment")}</DialogTitle>
          <DialogDescription>{t("addAssessmentHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="as-subject">{t("subject")}</Label>
            {subjects ? (
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="as-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="as-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-title">{t("assessmentTitle")}</Label>
            <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("assessmentPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-max">{t("maxScore")}</Label>
              <Input id="as-max" type="number" inputMode="decimal" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-weight">{t("weight")}</Label>
              <Input id="as-weight" type="number" inputMode="decimal" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("weightHint")}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit">{t("add")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
