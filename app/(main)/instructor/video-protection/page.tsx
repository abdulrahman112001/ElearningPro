"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { BookLock, EyeOff, Info, Loader2, Plus, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AvatarName,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/shared"

interface Row {
  id: string
  viewsUsed: number
  viewsAllowed: number
  extraViews: number
  lastViewedAt: string
  student: { id: string; name: string | null; email: string | null; image: string | null; phone: string | null }
  lesson: { id: string; titleEn: string; titleAr: string | null; maxViews: number | null }
  course: { id: string; titleEn: string; titleAr: string | null; slug: string }
}

interface Data {
  rows: Row[]
  defaultMaxViews: number | null
  stats: { blocked: number; students: number; limitedLessons: number }
}

const GRANT_OPTIONS = [1, 2, 3, 5, 10]

export default function InstructorVideoProtectionPage() {
  const t = useTranslations("videoProtection")
  const locale = useLocale()
  const [data, setData] = React.useState<Data | null>(null)
  const [error, setError] = React.useState(false)
  const [amounts, setAmounts] = React.useState<Record<string, string>>({})
  const [granting, setGranting] = React.useState<string | null>(null)

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  const pick = (en: string, ar: string | null) => (locale === "ar" ? ar || en : en || ar || "")

  const load = React.useCallback(() => {
    fetch("/api/instructor/lesson-views")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d: Data) => {
        setData(d)
        setError(false)
      })
      .catch(() => {
        setError(true)
        setData({ rows: [], defaultMaxViews: null, stats: { blocked: 0, students: 0, limitedLessons: 0 } })
      })
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const grant = async (row: Row) => {
    const extra = Number(amounts[row.id] ?? "1")
    setGranting(row.id)
    try {
      const res = await fetch("/api/instructor/lesson-views/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: row.lesson.id, studentId: row.student.id, extra }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("granted", { count: extra, name: row.student.name ?? "" }))
      load()
    } catch {
      toast.error(t("grantFailed"))
    } finally {
      setGranting(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title={t("teacherTitle")} description={t("teacherSubtitle")} />

      {data === null ? (
        <StatGridSkeleton count={3} className="lg:grid-cols-3" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <StatCard label={t("statBlocked")} value={nf.format(data.stats.blocked)} icon={EyeOff} tone="danger" />
          <StatCard label={t("statStudents")} value={nf.format(data.stats.students)} icon={Users} tone="warning" />
          <StatCard
            label={t("statLimitedLessons")}
            value={nf.format(data.stats.limitedLessons)}
            icon={BookLock}
            tone="info"
            className="col-span-2 lg:col-span-1"
          />
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p>{t("teacherHowTo")}</p>
          {data?.defaultMaxViews != null && (
            <p>{t("platformDefault", { count: data.defaultMaxViews })}</p>
          )}
        </div>
      </div>

      {data === null ? (
        <TableSkeleton rows={5} columns={4} />
      ) : (
        <SectionCard
          icon={EyeOff}
          title={t("blockedTitle")}
          description={t("blockedHint")}
          contentClassName="p-0"
        >
          {data.rows.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={ShieldCheck}
              title={error ? t("loadFailed") : t("blockedEmpty")}
              description={error ? undefined : t("blockedEmptyHint")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="ps-4 sm:ps-6">{t("student")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("lesson")}</TableHead>
                  <TableHead>{t("views")}</TableHead>
                  <TableHead className="pe-4 text-end sm:pe-6">{t("grant")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id} data-testid="blocked-row">
                    <TableCell className="ps-4 sm:ps-6">
                      <AvatarName
                        size="sm"
                        name={row.student.name}
                        image={row.student.image}
                        secondary={<span dir="ltr">{row.student.phone || row.student.email}</span>}
                        className="max-w-[9rem] sm:max-w-[14rem]"
                      />
                      <div className="mt-1 truncate text-xs text-muted-foreground md:hidden">
                        {pick(row.lesson.titleEn, row.lesson.titleAr)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] md:table-cell">
                      <div className="truncate font-medium">{pick(row.lesson.titleEn, row.lesson.titleAr)}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {pick(row.course.titleEn, row.course.titleAr)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-semibold tabular-nums">
                        {t("usedOf", { used: nf.format(row.viewsUsed), allowed: nf.format(row.viewsAllowed) })}
                      </div>
                      <div className="text-xs text-muted-foreground">{dateFmt.format(new Date(row.lastViewedAt))}</div>
                    </TableCell>
                    <TableCell className="pe-4 sm:pe-6">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={amounts[row.id] ?? "1"}
                          onValueChange={(v) => setAmounts((a) => ({ ...a, [row.id]: v }))}
                        >
                          <SelectTrigger className="h-8 w-16" aria-label={t("grantAmount")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRANT_OPTIONS.map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                +{nf.format(n)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={granting === row.id}
                          onClick={() => grant(row)}
                        >
                          {granting === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">{t("grantViews")}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      )}
    </div>
  )
}
