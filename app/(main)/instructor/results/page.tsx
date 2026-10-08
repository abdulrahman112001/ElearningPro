"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  AlertTriangle,
  Award,
  BarChart3,
  ClipboardCheck,
  FileQuestion,
  Medal,
  Target,
  Trophy,
  Users,
} from "lucide-react"
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
import { Label } from "@/components/ui/label"
import {
  AvatarName,
  EmptyState,
  ListSkeleton,
  PageHeader,
  ScoreBar,
  SectionCard,
  StatCard,
  StatGridSkeleton,
  TableSkeleton,
  scoreTone,
  toneStyles,
  type Tone,
} from "@/components/shared"
import { SendAlertDialog } from "@/components/instructor/send-alert-dialog"
import { cn } from "@/lib/utils"

const ALL = "__all__"

interface RankingRow {
  rank: number
  studentId: string
  name: string | null
  email: string | null
  image: string | null
  hasGuardianEmail: boolean
  averageScore: number
  quizzesTaken: number
  quizzesPassed: number
  totalQuizzes: number
  attempts: number
  lastAttemptAt: string | null
}

interface QuizStat {
  quizId: string
  title: string
  course: { id: string; titleAr: string; titleEn: string }
  passingScore: number
  students: number
  averageScore: number | null
  passRate: number | null
}

interface ResultsData {
  ranking: RankingRow[]
  top: RankingRow[]
  bottom: RankingRow[]
  quizStats: QuizStat[]
  summary: { students: number; averageScore: number | null; quizzes: number }
}

interface Option {
  id: string
  label: string
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-amber-400/20 text-amber-700 ring-amber-400/40 dark:text-amber-300"
      : rank === 2
        ? "bg-slate-400/20 text-slate-700 ring-slate-400/40 dark:text-slate-300"
        : rank === 3
          ? "bg-orange-400/20 text-orange-700 ring-orange-400/40 dark:text-orange-300"
          : "bg-muted text-muted-foreground ring-border"
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ring-1 ring-inset",
        medal
      )}
    >
      {rank}
    </span>
  )
}

export default function InstructorResultsPage() {
  const t = useTranslations("results")
  const locale = useLocale()
  const [courses, setCourses] = React.useState<Option[]>([])
  const [groups, setGroups] = React.useState<Option[]>([])
  const [courseId, setCourseId] = React.useState(ALL)
  const [groupId, setGroupId] = React.useState(ALL)
  const [data, setData] = React.useState<ResultsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  const pick = React.useCallback(
    (ar?: string | null, en?: string | null) => (locale === "ar" ? ar || en || "" : en || ar || ""),
    [locale]
  )
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 })
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
  })

  React.useEffect(() => {
    fetch("/api/instructor/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; titleAr: string; titleEn: string }[]) =>
        setCourses(list.map((c) => ({ id: c.id, label: pick(c.titleAr, c.titleEn) })))
      )
      .catch(() => setCourses([]))
    fetch("/api/instructor/groups")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string }[]) => setGroups(list.map((g) => ({ id: g.id, label: g.name }))))
      .catch(() => setGroups([]))
  }, [pick])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams()
    if (courseId !== ALL) qs.set("courseId", courseId)
    if (groupId !== ALL) qs.set("groupId", groupId)
    fetch(`/api/instructor/results?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d: ResultsData) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [courseId, groupId])

  const passRate = React.useMemo(() => {
    if (!data) return null
    const taken = data.ranking.reduce((s, r) => s + r.quizzesTaken, 0)
    const passed = data.ranking.reduce((s, r) => s + r.quizzesPassed, 0)
    return taken ? Math.round((passed / taken) * 100) : null
  }, [data])

  const studentRow = (row: RankingRow, variant: "top" | "bottom") => (
    <li key={row.studentId} className="flex items-center gap-3 px-4 py-3 sm:px-6">
      {variant === "top" ? (
        <RankBadge rank={row.rank} />
      ) : (
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      )}
      <AvatarName
        name={row.name}
        image={row.image}
        size="sm"
        secondary={t("quizzesPassedOf", { passed: row.quizzesPassed, total: row.quizzesTaken })}
        className="flex-1"
      />
      <span className={cn("shrink-0 text-sm font-bold tabular-nums", toneStyles[scoreTone(row.averageScore)].text)}>
        {nf.format(row.averageScore)}%
      </span>
      {variant === "bottom" && (
        <SendAlertDialog
          iconOnly
          student={{ id: row.studentId, name: row.name, hasGuardianEmail: row.hasGuardianEmail }}
        />
      )}
    </li>
  )

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title={t("title")} description={t("subtitle")}>
        <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-soft sm:grid-cols-2 sm:p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("filterCourse")}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allCourses")}</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("filterGroup")}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allGroups")}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PageHeader>

      {loading && !data ? (
        <>
          <StatGridSkeleton />
          <div className="grid gap-6 lg:grid-cols-2">
            <ListSkeleton rows={3} />
            <ListSkeleton rows={3} />
          </div>
          <TableSkeleton rows={6} columns={5} />
        </>
      ) : error || !data ? (
        <EmptyState icon={AlertTriangle} title={t("loadFailed")} />
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "pointer-events-none opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label={t("statStudents")} value={nf.format(data.summary.students)} icon={Users} />
            <StatCard
              label={t("statAverage")}
              value={data.summary.averageScore === null ? "—" : `${nf.format(data.summary.averageScore)}%`}
              icon={Target}
              tone={data.summary.averageScore === null ? "info" : (scoreTone(data.summary.averageScore) as Exclude<Tone, "neutral">)}
            />
            <StatCard label={t("statQuizzes")} value={nf.format(data.summary.quizzes)} icon={FileQuestion} tone="info" />
            <StatCard
              label={t("statPassRate")}
              value={passRate === null ? "—" : `${nf.format(passRate)}%`}
              icon={ClipboardCheck}
              tone="success"
            />
          </div>

          {data.ranking.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title={t("emptyTitle")}
              description={data.summary.quizzes === 0 ? t("emptyNoQuizzes") : t("emptyNoAttempts")}
            />
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard
                  icon={Trophy}
                  title={t("topStudents")}
                  description={t("topStudentsHint")}
                  contentClassName="p-0"
                >
                  <ul className="divide-y">{data.top.map((r) => studentRow(r, "top"))}</ul>
                </SectionCard>
                <SectionCard
                  icon={AlertTriangle}
                  title={t("needsAttention")}
                  description={t("needsAttentionHint")}
                  contentClassName="p-0"
                >
                  {data.bottom.length === 0 ? (
                    <EmptyState variant="plain" size="sm" icon={Award} title={t("noOneBehind")} />
                  ) : (
                    <ul className="divide-y">{data.bottom.map((r) => studentRow(r, "bottom"))}</ul>
                  )}
                </SectionCard>
              </div>

              <SectionCard
                icon={Medal}
                title={t("rankingTitle")}
                description={t("rankingHint", { count: data.ranking.length })}
                contentClassName="p-0"
              >
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-14 ps-4 sm:ps-6">#</TableHead>
                      <TableHead>{t("student")}</TableHead>
                      <TableHead className="min-w-[9rem]">{t("average")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("passed")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("attempts")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("lastAttempt")}</TableHead>
                      <TableHead className="pe-4 text-end sm:pe-6">
                        <span className="sr-only">{t("actions")}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ranking.map((row) => (
                      <TableRow key={row.studentId}>
                        <TableCell className="ps-4 sm:ps-6">
                          <RankBadge rank={row.rank} />
                        </TableCell>
                        <TableCell>
                          <AvatarName
                            name={row.name}
                            image={row.image}
                            size="sm"
                            secondary={<span dir="ltr">{row.email}</span>}
                            className="max-w-[11rem] sm:max-w-[16rem]"
                          />
                        </TableCell>
                        <TableCell>
                          <ScoreBar
                            value={row.averageScore}
                            size="sm"
                            valueLabel={`${nf.format(row.averageScore)}%`}
                          />
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">
                          {t("passedOfTotal", { passed: row.quizzesPassed, total: row.totalQuizzes })}
                        </TableCell>
                        <TableCell className="hidden tabular-nums lg:table-cell">{nf.format(row.attempts)}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                          {row.lastAttemptAt ? dateFmt.format(new Date(row.lastAttemptAt)) : "—"}
                        </TableCell>
                        <TableCell className="pe-4 text-end sm:pe-6">
                          <div className="hidden sm:block">
                            <SendAlertDialog
                              student={{ id: row.studentId, name: row.name, hasGuardianEmail: row.hasGuardianEmail }}
                            />
                          </div>
                          <div className="sm:hidden">
                            <SendAlertDialog
                              iconOnly
                              student={{ id: row.studentId, name: row.name, hasGuardianEmail: row.hasGuardianEmail }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            </>
          )}

          {data.quizStats.length > 0 && (
            <SectionCard icon={FileQuestion} title={t("quizStatsTitle")} description={t("quizStatsHint")} contentClassName="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="ps-4 sm:ps-6">{t("quiz")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("passingScore")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("studentsCol")}</TableHead>
                    <TableHead className="min-w-[8rem]">{t("average")}</TableHead>
                    <TableHead className="min-w-[8rem] pe-4 sm:pe-6">{t("passRate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.quizStats.map((q) => (
                    <TableRow key={q.quizId}>
                      <TableCell className="ps-4 sm:ps-6">
                        <p className="max-w-[14rem] truncate font-medium sm:max-w-xs">{q.title}</p>
                        <p className="max-w-[14rem] truncate text-xs text-muted-foreground sm:max-w-xs">
                          {pick(q.course.titleAr, q.course.titleEn)}
                        </p>
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">{nf.format(q.passingScore)}%</TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">{nf.format(q.students)}</TableCell>
                      <TableCell>
                        {q.averageScore === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <ScoreBar
                            value={q.averageScore}
                            size="sm"
                            valueLabel={`${nf.format(q.averageScore)}%`}
                            thresholds={{ good: Math.max(q.passingScore, 1), fair: Math.max(q.passingScore - 15, 0) }}
                          />
                        )}
                      </TableCell>
                      <TableCell className="pe-4 sm:pe-6">
                        {q.passRate === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <ScoreBar value={q.passRate} size="sm" valueLabel={`${nf.format(q.passRate)}%`} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}
