"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { BookOpen, ChevronRight, GraduationCap, Loader2, Plus, Users, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CardSkeleton,
  EmptyState,
  PageHeader,
  StatCard,
  StatGridSkeleton,
} from "@/components/shared"

const NO_GRADE = "__none__"

interface GradeLevel {
  id: string
  nameAr: string
  nameEn: string
}

interface GroupRow {
  id: string
  name: string
  description: string | null
  createdAt: string
  gradeLevel: GradeLevel | null
  _count: { members: number; courses: number }
}

export default function InstructorGroupsPage() {
  const t = useTranslations("groups")
  const tc = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const [groups, setGroups] = React.useState<GroupRow[] | null>(null)
  const [grades, setGrades] = React.useState<GradeLevel[]>([])
  const [loadError, setLoadError] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [gradeLevelId, setGradeLevelId] = React.useState(NO_GRADE)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const gradeName = (g: GradeLevel | null | undefined) =>
    g ? (locale === "ar" ? g.nameAr || g.nameEn : g.nameEn || g.nameAr) : null

  const load = React.useCallback(async () => {
    try {
      const [gRes, gradeRes] = await Promise.all([
        fetch("/api/instructor/groups"),
        fetch("/api/grade-levels"),
      ])
      if (!gRes.ok) throw new Error()
      setGroups(await gRes.json())
      if (gradeRes.ok) setGrades(await gradeRes.json())
    } catch {
      setLoadError(true)
      setGroups([])
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setName("")
    setDescription("")
    setGradeLevelId(NO_GRADE)
    setFormError(null)
  }

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setFormError(t("nameRequired"))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch("/api/instructor/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          gradeLevelId: gradeLevelId === NO_GRADE ? null : gradeLevelId,
        }),
      })
      if (!res.ok) throw new Error()
      const group = await res.json()
      toast.success(t("created"))
      setOpen(false)
      resetForm()
      router.push(`/instructor/groups/${group.id}`)
    } catch {
      setFormError(t("createFailed"))
    } finally {
      setSaving(false)
    }
  }

  const totalMembers = groups?.reduce((s, g) => s + g._count.members, 0) ?? 0
  const totalCourses = groups?.reduce((s, g) => s + g._count.courses, 0) ?? 0
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersRound}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("newGroup")}
          </Button>
        }
      />

      {groups === null ? (
        <>
          <StatGridSkeleton count={3} className="lg:grid-cols-3" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} withImage={false} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard label={t("statGroups")} value={nf.format(groups.length)} icon={UsersRound} />
            <StatCard label={t("statMembers")} value={nf.format(totalMembers)} icon={Users} tone="info" />
            <StatCard
              label={t("statCourses")}
              value={nf.format(totalCourses)}
              icon={BookOpen}
              tone="success"
              className="col-span-2 lg:col-span-1"
            />
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title={loadError ? t("loadFailed") : t("emptyTitle")}
              description={loadError ? undefined : t("emptyDescription")}
              action={
                <Button onClick={() => setOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("createFirst")}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/instructor/groups/${group.id}`}
                  className="group flex flex-col rounded-lg border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                        <UsersRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{group.name}</h3>
                        {gradeName(group.gradeLevel) && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                            {gradeName(group.gradeLevel)}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary rtl:rotate-180" />
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                    {group.description || t("noDescription")}
                  </p>
                  <div className="mt-4 flex items-center gap-4 border-t pt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      {t("membersCount", { count: group._count.members })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" />
                      {t("coursesCount", { count: group._count.courses })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("newGroup")}</DialogTitle>
            <DialogDescription>{t("newGroupDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={createGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">{t("nameLabel")}</Label>
              <Input
                id="group-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">
                {t("descriptionLabel")}{" "}
                <span className="text-xs font-normal text-muted-foreground">({tc("optional")})</span>
              </Label>
              <Textarea
                id="group-description"
                value={description}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("gradeLabel")}</Label>
              <Select value={gradeLevelId} onValueChange={setGradeLevelId} disabled={saving}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectGrade")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GRADE}>{t("noGrade")}</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {gradeName(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
