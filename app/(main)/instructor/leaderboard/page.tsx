"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Activity, AlertTriangle, BookOpen, Calendar, Infinity as InfinityIcon, Star, Trophy, Users } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { EmptyState, ListSkeleton, PageHeader, StatCard, StatGridSkeleton } from "@/components/shared"
import {
  LeaderboardList,
  Podium,
  Segmented,
  type BoardEntry,
} from "@/components/gamification/leaderboard-view"
import { cn } from "@/lib/utils"

type Period = "week" | "all"

interface BoardData {
  entries: BoardEntry[]
  weekStart: string
  summary: { students: number; totalPoints: number; averagePoints: number; active: number }
}

export default function InstructorLeaderboardPage() {
  const t = useTranslations("gamification")
  const locale = useLocale()
  const isAr = locale === "ar"
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US")

  const [groups, setGroups] = React.useState<{ id: string; label: string }[] | null>(null)
  const [courses, setCourses] = React.useState<{ id: string; label: string }[] | null>(null)
  // "group:<id>" or "course:<id>"
  const [target, setTarget] = React.useState("")
  const [period, setPeriod] = React.useState<Period>("week")
  const [data, setData] = React.useState<BoardData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch("/api/instructor/groups").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/instructor/courses").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([g, c]: [{ id: string; name: string }[], { id: string; titleAr: string; titleEn: string }[]]) => {
      const gl = (Array.isArray(g) ? g : []).map((x) => ({ id: x.id, label: x.name }))
      const cl = (Array.isArray(c) ? c : []).map((x) => ({
        id: x.id,
        label: (isAr ? x.titleAr : x.titleEn) || x.titleAr || x.titleEn,
      }))
      setGroups(gl)
      setCourses(cl)
      setTarget((cur) => cur || (gl[0] ? `group:${gl[0].id}` : cl[0] ? `course:${cl[0].id}` : ""))
    })
  }, [isAr])

  React.useEffect(() => {
    if (!target) return
    const [kind, id] = target.split(":")
    let cancelled = false
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams({ period, [kind === "group" ? "groupId" : "courseId"]: id })
    fetch(`/api/gamification/instructor/leaderboard?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BoardData) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [target, period])

  const ready = groups !== null && courses !== null
  const nothing = ready && groups.length === 0 && courses.length === 0

  return (
    <div className="space-y-6">
      <PageHeader icon={Trophy} title={t("teacherTitle")} description={t("teacherSubtitle")}>
        {ready && !nothing && (
          <div className="grid gap-3 rounded-lg border bg-card p-3 shadow-soft sm:grid-cols-2 sm:p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("pickTarget")}</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t("scopeGroups")}</SelectLabel>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={`group:${g.id}`}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {courses.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t("scopeCourses")}</SelectLabel>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={`course:${c.id}`}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("periodLabel")}</Label>
              <div>
                <Segmented<Period>
                  label={t("periodLabel")}
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: "week", label: t("periodWeek"), icon: Calendar },
                    { value: "all", label: t("periodAll"), icon: InfinityIcon },
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </PageHeader>

      {nothing ? (
        <EmptyState icon={Users} title={t("teacherEmpty")} description={t("teacherEmptyHint")} />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title={t("loadFailed")} />
      ) : !ready || (loading && !data) ? (
        <>
          <StatGridSkeleton />
          <ListSkeleton rows={6} />
        </>
      ) : data ? (
        <div className={cn("space-y-6 transition-opacity", loading && "pointer-events-none opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label={t("statStudents")} value={nf.format(data.summary.students)} icon={Users} />
            <StatCard label={t("statActive")} value={nf.format(data.summary.active)} icon={Activity} tone="success" />
            <StatCard label={t("statTotal")} value={nf.format(data.summary.totalPoints)} icon={Star} tone="info" />
            <StatCard label={t("statAverage")} value={nf.format(data.summary.averagePoints)} icon={BookOpen} tone="warning" />
          </div>
          {data.entries.some((e) => e.points > 0) && (
            <div className="rounded-xl border bg-card p-4 shadow-soft">
              <Podium entries={data.entries.filter((e) => e.points > 0)} />
            </div>
          )}
          <LeaderboardList
            entries={data.entries}
            title={t("rankingTitle")}
            description={t("studentsCount", { count: data.summary.students })}
            emptyTitle={t("teacherNoStudents")}
          />
        </div>
      ) : null}
    </div>
  )
}
