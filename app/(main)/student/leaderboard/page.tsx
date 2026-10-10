"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, BookOpen, Calendar, Globe, Infinity as InfinityIcon, Trophy, Users } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState, ListSkeleton, PageHeader } from "@/components/shared"
import {
  LeaderboardList,
  Podium,
  Segmented,
  type BoardEntry,
} from "@/components/gamification/leaderboard-view"
import { cn } from "@/lib/utils"

type Scope = "group" | "course" | "platform"
type Period = "week" | "all"

interface BoardData {
  entries: BoardEntry[]
  me: BoardEntry | null
  weekStart: string
  options: {
    groups: { id: string; name: string }[]
    courses: { id: string; titleAr: string; titleEn: string }[]
  }
}

export default function StudentLeaderboardPage() {
  const t = useTranslations("gamification")
  const locale = useLocale()
  const isAr = locale === "ar"
  const dateFmt = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", { weekday: "long", month: "short", day: "numeric" })

  const [scope, setScope] = React.useState<Scope>("group")
  const [period, setPeriod] = React.useState<Period>("week")
  const [targetId, setTargetId] = React.useState<string>("")
  const [options, setOptions] = React.useState<BoardData["options"] | null>(null)
  const [data, setData] = React.useState<BoardData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  // Load the scope options once (the platform board also returns them).
  React.useEffect(() => {
    fetch("/api/gamification/leaderboard?scope=platform&period=week")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BoardData) => {
        setOptions(d.options)
        if (d.options.groups.length > 0) {
          setScope("group")
          setTargetId(d.options.groups[0].id)
        } else if (d.options.courses.length > 0) {
          setScope("course")
          setTargetId(d.options.courses[0].id)
        } else {
          setScope("platform")
        }
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const list = React.useMemo(() => {
    if (!options) return []
    if (scope === "group") return options.groups.map((g) => ({ id: g.id, label: g.name }))
    if (scope === "course")
      return options.courses.map((c) => ({ id: c.id, label: (isAr ? c.titleAr : c.titleEn) || c.titleAr || c.titleEn }))
    return []
  }, [options, scope, isAr])

  const changeScope = (s: Scope) => {
    setScope(s)
    if (!options) return
    if (s === "group") setTargetId(options.groups[0]?.id ?? "")
    else if (s === "course") setTargetId(options.courses[0]?.id ?? "")
    else setTargetId("")
  }

  React.useEffect(() => {
    if (!options) return
    if (scope !== "platform" && !targetId) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams({ scope, period })
    if (scope !== "platform") qs.set("id", targetId)
    fetch(`/api/gamification/leaderboard?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BoardData) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [options, scope, period, targetId])

  const noTarget = scope !== "platform" && list.length === 0

  return (
    <div className="space-y-6">
      <PageHeader icon={Trophy} title={t("leaderboardTitle")} description={t("leaderboardSubtitle")}>
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-soft sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <Segmented<Scope>
            label={t("scopeLabel")}
            value={scope}
            onChange={changeScope}
            options={[
              { value: "group", label: t("scopeGroups"), icon: Users },
              { value: "course", label: t("scopeCourses"), icon: BookOpen },
              { value: "platform", label: t("scopePlatform"), icon: Globe },
            ]}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {scope !== "platform" && list.length > 0 && (
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="w-full sm:w-56" aria-label={scope === "group" ? t("pickGroup") : t("pickCourse")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {list.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
      </PageHeader>

      {error ? (
        <EmptyState icon={AlertTriangle} title={t("loadFailed")} />
      ) : noTarget ? (
        <EmptyState
          icon={scope === "group" ? Users : BookOpen}
          title={scope === "group" ? t("noGroups") : t("noCourses")}
          description={t("tryPlatform")}
        />
      ) : loading && !data ? (
        <ListSkeleton rows={6} />
      ) : data ? (
        <div className={cn("space-y-6 transition-opacity", loading && "pointer-events-none opacity-60")}>
          {period === "week" && (
            <p className="text-sm text-muted-foreground">
              {t("weekSince", { date: dateFmt.format(new Date(data.weekStart)) })}
            </p>
          )}
          {data.entries.some((e) => e.points > 0) && (
            <div className="rounded-xl border bg-card p-4 shadow-soft">
              <Podium entries={data.entries.filter((e) => e.points > 0)} />
            </div>
          )}
          <LeaderboardList
            entries={data.entries}
            me={data.me}
            title={t("rankingTitle")}
            description={data.me ? t("yourRank", { rank: data.me.rank }) : undefined}
            emptyTitle={t("emptyBoard")}
            emptyDescription={t("emptyBoardHint")}
          />
        </div>
      ) : null}
    </div>
  )
}
