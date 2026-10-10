"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, Award, Flame, History, Lock, Star, Trophy, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CardSkeleton,
  EmptyState,
  ListSkeleton,
  PageHeader,
  SectionCard,
  StatCard,
  StatGridSkeleton,
} from "@/components/shared"
import { BadgeIcon } from "@/components/gamification/badge-icon"
import { LevelRing } from "@/components/gamification/level-ring"
import { cn } from "@/lib/utils"

interface Achievements {
  points: number
  weeklyPoints: number
  level: { level: number; points: number; levelStart: number; nextLevelAt: number; toNext: number; progress: number }
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  badges: {
    key: string
    nameAr: string
    nameEn: string
    descriptionAr: string | null
    descriptionEn: string | null
    icon: string | null
    earned: boolean
    awardedAt: string | null
  }[]
  history: { id: string; points: number; reason: string; createdAt: string }[]
}

const REASONS = [
  "lesson_completed",
  "quiz_passed",
  "perfect_score",
  "course_completed",
  "assignment_submitted",
  "streak_bonus",
] as const

export default function AchievementsPage() {
  const t = useTranslations("gamification")
  const locale = useLocale()
  const isAr = locale === "ar"
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" })
  const [data, setData] = React.useState<Achievements | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    fetch("/api/gamification/me")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setData)
      .catch(() => setError(true))
  }, [])

  const reasonLabel = (reason: string) =>
    (REASONS as readonly string[]).includes(reason) ? t(`reasons.${reason}`) : reason

  const earnedCount = data?.badges.filter((b) => b.earned).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Trophy}
        title={t("achievementsTitle")}
        description={t("achievementsSubtitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/student/leaderboard">
              <Trophy className="me-2 h-4 w-4" />
              {t("viewLeaderboard")}
            </Link>
          </Button>
        }
      />

      {error ? (
        <EmptyState icon={AlertTriangle} title={t("loadFailed")} />
      ) : !data ? (
        <>
          <StatGridSkeleton />
          <CardSkeleton />
          <ListSkeleton rows={4} />
        </>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col items-center gap-5 rounded-xl border bg-card p-5 shadow-soft sm:flex-row lg:col-span-2">
              <LevelRing level={data.level.level} progress={data.level.progress} label={t("level")} />
              <div className="w-full min-w-0 flex-1 space-y-3 text-center sm:text-start">
                <div>
                  <p className="text-sm text-muted-foreground">{t("totalPoints")}</p>
                  <p className="text-3xl font-bold tabular-nums">{nf.format(data.points)}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 rtl:bg-gradient-to-l"
                      style={{ width: `${data.level.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("toNextLevel", { count: data.level.toNext, level: data.level.level + 1 })}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "flex items-center gap-4 rounded-xl border p-5 shadow-soft",
                data.currentStreak > 0
                  ? "border-orange-300/50 bg-gradient-to-br from-orange-50 to-amber-50 dark:border-orange-500/30 dark:from-orange-950/40 dark:to-amber-950/30"
                  : "bg-card"
              )}
            >
              <span
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
                  data.currentStreak > 0 ? "bg-orange-500/15 text-orange-500" : "bg-muted text-muted-foreground"
                )}
              >
                <Flame className={cn("h-8 w-8", data.currentStreak > 0 && "animate-pulse")} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t("currentStreak")}</p>
                <p className="text-2xl font-bold tabular-nums">{t("daysCount", { count: data.currentStreak })}</p>
                <p className="text-xs text-muted-foreground">
                  {t("longestStreak")}: {t("daysCount", { count: data.longestStreak })}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label={t("weeklyPoints")} value={nf.format(data.weeklyPoints)} icon={Zap} tone="info" />
            <StatCard label={t("totalPoints")} value={nf.format(data.points)} icon={Star} />
            <StatCard
              label={t("badgesEarned")}
              value={`${nf.format(earnedCount)} / ${nf.format(data.badges.length)}`}
              icon={Award}
              tone="success"
            />
            <StatCard label={t("longestStreak")} value={t("daysCount", { count: data.longestStreak })} icon={Flame} tone="warning" />
          </div>

          <SectionCard icon={Award} title={t("badgesTitle")} description={t("badgesHint")}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.badges.map((b) => (
                <li
                  key={b.key}
                  data-testid={`badge-${b.key}`}
                  data-earned={b.earned}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
                    b.earned ? "border-primary/30 bg-primary/5" : "bg-muted/30 opacity-70"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      b.earned
                        ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"
                        : "bg-muted text-muted-foreground grayscale"
                    )}
                  >
                    <BadgeIcon name={b.icon} />
                  </span>
                  {!b.earned && (
                    <Lock className="absolute end-3 top-3 h-3.5 w-3.5 text-muted-foreground" aria-label={t("locked")} />
                  )}
                  <p className="text-sm font-semibold leading-tight">{isAr ? b.nameAr : b.nameEn}</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {isAr ? b.descriptionAr : b.descriptionEn}
                  </p>
                  <p className="text-[0.7rem] font-medium text-muted-foreground">
                    {b.earned && b.awardedAt
                      ? t("earnedOn", { date: dateFmt.format(new Date(b.awardedAt)) })
                      : t("locked")}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard icon={History} title={t("historyTitle")} contentClassName="p-0">
            {data.history.length === 0 ? (
              <EmptyState variant="plain" size="sm" icon={Star} title={t("historyEmpty")} description={t("historyEmptyHint")} />
            ) : (
              <ul className="divide-y">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Star className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{reasonLabel(h.reason)}</p>
                      <p className="text-xs text-muted-foreground">{dateFmt.format(new Date(h.createdAt))}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{nf.format(h.points)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
