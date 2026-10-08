"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  UsersRound,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState, SectionCard, StatCard, StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"

export const GRADE_STAGES = ["primary", "preparatory", "secondary", "university", "other"] as const
type Stage = (typeof GRADE_STAGES)[number]
const NO_STAGE = "none"

export interface GradeLevelRow {
  id: string
  nameAr: string
  nameEn: string
  stage: string | null
  position: number
  isActive: boolean
  _count: { courses: number; students: number; classGroups: number }
}

interface FormState {
  nameAr: string
  nameEn: string
  stage: string
  position: string
}

const emptyForm: FormState = { nameAr: "", nameEn: "", stage: NO_STAGE, position: "0" }

async function readError(res: Response) {
  try {
    const data = await res.json()
    return typeof data?.error === "string" ? data.error : null
  } catch {
    return null
  }
}

export function GradeLevelsManager({ grades }: { grades: GradeLevelRow[] }) {
  const t = useTranslations("adminGrades")
  const locale = useLocale()
  const router = useRouter()
  const nf = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-EG"), [locale])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GradeLevelRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<GradeLevelRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const primaryName = (g: GradeLevelRow) => (locale === "en" ? g.nameEn : g.nameAr)
  const secondaryName = (g: GradeLevelRow) => (locale === "en" ? g.nameAr : g.nameEn)

  const groups = useMemo(() => {
    const order: (Stage | typeof NO_STAGE)[] = [...GRADE_STAGES, NO_STAGE]
    return order
      .map((stage) => ({
        stage,
        items: grades
          .filter((g) =>
            stage === NO_STAGE
              ? !g.stage || !(GRADE_STAGES as readonly string[]).includes(g.stage)
              : g.stage === stage
          )
          .sort((a, b) => a.position - b.position || a.nameEn.localeCompare(b.nameEn)),
      }))
      .filter((g) => g.items.length > 0)
  }, [grades])

  const stats = useMemo(
    () => ({
      total: grades.length,
      active: grades.filter((g) => g.isActive).length,
      students: grades.reduce((s, g) => s + g._count.students, 0),
      courses: grades.reduce((s, g) => s + g._count.courses, 0),
    }),
    [grades]
  )

  const openCreate = () => {
    const nextPosition = grades.reduce((m, g) => Math.max(m, g.position), 0) + 1
    setEditing(null)
    setForm({ ...emptyForm, position: String(grades.length ? nextPosition : 1) })
    setDialogOpen(true)
  }

  const openEdit = (g: GradeLevelRow) => {
    setEditing(g)
    setForm({
      nameAr: g.nameAr,
      nameEn: g.nameEn,
      stage: g.stage ?? NO_STAGE,
      position: String(g.position),
    })
    setDialogOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameAr = form.nameAr.trim()
    const nameEn = form.nameEn.trim()
    const position = Number.parseInt(form.position, 10)
    if (!nameAr || !nameEn) {
      toast.error(t("namesRequired"))
      return
    }
    if (!Number.isInteger(position)) {
      toast.error(t("positionInvalid"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        editing ? `/api/admin/grade-levels/${editing.id}` : "/api/admin/grade-levels",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nameAr,
            nameEn,
            stage: form.stage === NO_STAGE ? null : form.stage,
            position,
          }),
        }
      )
      if (!res.ok) throw new Error((await readError(res)) ?? t("saveFailed"))
      toast.success(editing ? t("updated") : t("created"))
      setDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (g: GradeLevelRow, isActive: boolean) => {
    setToggling(g.id)
    try {
      const res = await fetch(`/api/admin/grade-levels/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error((await readError(res)) ?? t("saveFailed"))
      toast.success(isActive ? t("activated") : t("deactivated"))
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"))
    } finally {
      setToggling(null)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/grade-levels/${toDelete.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await readError(res)) ?? t("deleteFailed"))
      toast.success(t("deleted"))
      setToDelete(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"))
    } finally {
      setDeleting(false)
    }
  }

  const usage = (g: GradeLevelRow) => [
    { icon: BookOpen, value: g._count.courses, label: t("coursesCount", { count: g._count.courses }) },
    { icon: GraduationCap, value: g._count.students, label: t("studentsCount", { count: g._count.students }) },
    { icon: UsersRound, value: g._count.classGroups, label: t("groupsCount", { count: g._count.classGroups }) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("statTotal")} value={nf.format(stats.total)} icon={Layers} tone="primary" />
        <StatCard label={t("statActive")} value={nf.format(stats.active)} icon={CheckCircle2} tone="success" />
        <StatCard label={t("statStudents")} value={nf.format(stats.students)} icon={Users} tone="info" />
        <StatCard label={t("statCourses")} value={nf.format(stats.courses)} icon={BookOpen} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("add")}
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("add")}
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <SectionCard
            key={group.stage}
            title={t(`stages.${group.stage}` as "stages.primary")}
            description={t("gradesInStage", { count: group.items.length })}
            icon={GraduationCap}
            contentClassName="p-0"
          >
            {/* Column headings (desktop) */}
            <div className="hidden grid-cols-[3rem_minmax(0,1fr)_minmax(0,16rem)_9rem_6rem] items-center gap-4 border-b bg-muted/40 px-6 py-2.5 text-xs font-medium text-muted-foreground md:grid">
              <span>{t("order")}</span>
              <span>{t("name")}</span>
              <span>{t("usage")}</span>
              <span>{t("status")}</span>
              <span className="text-end">{t("actions")}</span>
            </div>
            <ul className="divide-y">
              {group.items.map((g) => (
                <li
                  key={g.id}
                  className={cn(
                    "flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-6 md:grid md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,16rem)_9rem_6rem] md:items-center md:gap-4",
                    !g.isActive && "bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-3 md:contents">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-xs font-semibold tabular-nums text-muted-foreground"
                      title={t("order")}
                    >
                      {nf.format(g.position)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-medium", !g.isActive && "text-muted-foreground")}>
                        {primaryName(g)}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        dir={locale === "en" ? "rtl" : "ltr"}
                      >
                        {secondaryName(g)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {usage(g).map(({ icon: Icon, value, label }) => (
                      <span
                        key={label}
                        title={label}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums",
                          value > 0 ? "bg-background text-foreground" : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">{label}</span>
                        <span aria-hidden="true">{nf.format(value)}</span>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 md:contents">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={g.isActive}
                        disabled={toggling === g.id}
                        onCheckedChange={(v) => toggleActive(g, v)}
                        aria-label={t("toggleActive", { name: primaryName(g) })}
                      />
                      <StatusBadge
                        status={g.isActive ? "ACTIVE" : "INACTIVE"}
                        label={g.isActive ? t("active") : t("inactive")}
                        className="md:hidden lg:inline-flex"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(g)}
                        aria-label={t("editNamed", { name: primaryName(g) })}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setToDelete(g)}
                        aria-label={t("deleteNamed", { name: primaryName(g) })}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        ))
      )}

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="space-y-6">
            <DialogHeader>
              <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
              <DialogDescription>{t("formDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="grade-name-ar">{t("nameAr")}</Label>
                <Input
                  id="grade-name-ar"
                  dir="rtl"
                  lang="ar"
                  value={form.nameAr}
                  maxLength={100}
                  placeholder={t("nameArPlaceholder")}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade-name-en">{t("nameEn")}</Label>
                <Input
                  id="grade-name-en"
                  dir="ltr"
                  lang="en"
                  value={form.nameEn}
                  maxLength={100}
                  placeholder={t("nameEnPlaceholder")}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade-stage">{t("stage")}</Label>
                <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                  <SelectTrigger id="grade-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`stages.${s}`)}
                      </SelectItem>
                    ))}
                    <SelectItem value={NO_STAGE}>{t("stages.none")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade-position">{t("order")}</Label>
                <Input
                  id="grade-position"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{t("orderHint")}</p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {editing ? t("save") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { name: toDelete ? primaryName(toDelete) : "" })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>{t("deleteBody")}</p>
                {toDelete && (
                  <ul className="space-y-1 rounded-md border bg-muted/40 p-3 text-foreground">
                    {usage(toDelete).map(({ icon: Icon, label }) => (
                      <li key={label} className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
                <p>{t("deleteAlternative")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
