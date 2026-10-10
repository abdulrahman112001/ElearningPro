"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, CalendarClock, ClipboardList, ClipboardPen, FileCheck2, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, PageHeader, SectionCard, StatCard, StatGridSkeleton, TableSkeleton } from "@/components/shared"
import { AssignmentFormDialog } from "@/components/homework/assignment-form-dialog"
import { intlLocale, relativeTime } from "@/components/school/format"
import { cn } from "@/lib/utils"

const ALL = "__all__"

interface Row {
  id: string
  title: string
  subject: string | null
  dueAt: string | null
  maxScore: number
  group: { id: string; name: string } | null
  course: { id: string; titleAr: string; titleEn: string } | null
  lesson: { id: string; titleAr: string; titleEn: string } | null
  targets: number
  submissions: number
  needsGrading: number
}

interface Data {
  assignments: Row[]
  summary: { total: number; needsGrading: number; dueSoon: number }
}

export default function InstructorAssignmentsPage() {
  const t = useTranslations("homework")
  const locale = useLocale()
  const router = useRouter()
  const pick = (ar: string, en: string) => (locale === "ar" ? ar || en : en || ar)
  const nf = new Intl.NumberFormat(intlLocale(locale))
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" })

  const [target, setTarget] = React.useState(ALL)
  const [dueSoon, setDueSoon] = React.useState(false)
  const [data, setData] = React.useState<Data | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<{ groups: { id: string; name: string }[]; courses: { id: string; titleAr: string; titleEn: string }[] }>({
    groups: [],
    courses: [],
  })

  React.useEffect(() => {
    fetch("/api/assignments/options")
      .then((r) => (r.ok ? r.json() : { groups: [], courses: [] }))
      .then(setOptions)
      .catch(() => {})
  }, [])

  const load = React.useCallback(() => {
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams()
    if (target.startsWith("g:")) qs.set("groupId", target.slice(2))
    if (target.startsWith("c:")) qs.set("courseId", target.slice(2))
    if (dueSoon) qs.set("dueSoon", "1")
    fetch(`/api/assignments?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        setData(await r.json())
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [target, dueSoon])

  React.useEffect(load, [load])

  const now = Date.now()

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title={t("teacher.title")}
        description={t("teacher.subtitle")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("teacher.new")}
          </Button>
        }
      >
        <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-soft sm:grid-cols-2 sm:p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("teacher.filterTarget")}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("teacher.allTargets")}</SelectItem>
                {options.groups.map((g) => (
                  <SelectItem key={g.id} value={`g:${g.id}`}>
                    {g.name}
                  </SelectItem>
                ))}
                {options.courses.map((c) => (
                  <SelectItem key={c.id} value={`c:${c.id}`}>
                    {pick(c.titleAr, c.titleEn)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:mt-5">
            <Label htmlFor="due-soon" className="text-sm">
              {t("teacher.dueSoonOnly")}
            </Label>
            <Switch id="due-soon" checked={dueSoon} onCheckedChange={setDueSoon} />
          </div>
        </div>
      </PageHeader>

      {loading && !data ? (
        <>
          <StatGridSkeleton count={3} />
          <TableSkeleton rows={5} columns={5} />
        </>
      ) : error || !data ? (
        <EmptyState icon={AlertTriangle} title={t("errors.loadFailed")} />
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "pointer-events-none opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard label={t("teacher.statTotal")} value={nf.format(data.summary.total)} icon={ClipboardList} />
            <StatCard label={t("teacher.statNeedsGrading")} value={nf.format(data.summary.needsGrading)} icon={ClipboardPen} tone="warning" />
            <StatCard label={t("teacher.statDueSoon")} value={nf.format(data.summary.dueSoon)} icon={CalendarClock} tone="info" />
          </div>

          {data.assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t("teacher.emptyTitle")}
              description={t("teacher.emptyHint")}
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="me-2 h-4 w-4" />
                  {t("teacher.new")}
                </Button>
              }
            />
          ) : (
            <SectionCard icon={FileCheck2} title={t("teacher.listTitle")} contentClassName="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="ps-4 sm:ps-6">{t("teacher.colTitle")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("teacher.colTarget")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("teacher.colDue")}</TableHead>
                    <TableHead>{t("teacher.colSubmitted")}</TableHead>
                    <TableHead className="pe-4 sm:pe-6">{t("teacher.colToGrade")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignments.map((a) => {
                    const overdue = a.dueAt && new Date(a.dueAt).getTime() < now
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/instructor/assignments/${a.id}`)}>
                        <TableCell className="ps-4 sm:ps-6">
                          <Link href={`/instructor/assignments/${a.id}`} className="block max-w-[12rem] truncate font-medium hover:underline sm:max-w-xs">
                            {a.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {[a.subject, t("teacher.outOf", { max: a.maxScore })].filter(Boolean).join(" · ")}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="inline-flex max-w-[14rem] items-center gap-1.5 truncate text-sm">
                            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {a.group ? a.group.name : a.course ? pick(a.course.titleAr, a.course.titleEn) : "—"}
                          </span>
                          {a.lesson && <p className="truncate text-xs text-muted-foreground">{pick(a.lesson.titleAr, a.lesson.titleEn)}</p>}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap sm:table-cell">
                          {a.dueAt ? (
                            <>
                              <p className="text-sm">{dateFmt.format(new Date(a.dueAt))}</p>
                              <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                                {relativeTime(locale, a.dueAt, now)}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{t("noDueDate")}</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {t("teacher.submittedOf", { done: a.submissions, total: a.targets })}
                        </TableCell>
                        <TableCell className="pe-4 sm:pe-6">
                          {a.needsGrading > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                              {t("teacher.needsGrading", { count: a.needsGrading })}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </SectionCard>
          )}
        </div>
      )}

      <AssignmentFormDialog open={open} onOpenChange={setOpen} onSaved={(a) => router.push(`/instructor/assignments/${a.id}`)} />
    </div>
  )
}
