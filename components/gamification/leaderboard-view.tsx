"use client"

import { useLocale, useTranslations } from "next-intl"
import { Crown, Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarName, EmptyState, SectionCard } from "@/components/shared"
import { cn } from "@/lib/utils"

export interface BoardEntry {
  rank: number
  userId: string
  name: string | null
  image: string | null
  points: number
  level: number
  isMe?: boolean
}

function initials(name: string | null) {
  return (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
}

export function RankBadge({ rank }: { rank: number }) {
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

const PODIUM_STYLE: Record<number, { bar: string; ring: string; height: string }> = {
  1: { bar: "from-amber-300 to-amber-500", ring: "ring-amber-400", height: "h-24 sm:h-28" },
  2: { bar: "from-slate-300 to-slate-400", ring: "ring-slate-400", height: "h-16 sm:h-20" },
  3: { bar: "from-orange-300 to-orange-500", ring: "ring-orange-400", height: "h-12 sm:h-14" },
}

/** Top three on a podium (2nd, 1st, 3rd from the start edge). */
export function Podium({ entries }: { entries: BoardEntry[] }) {
  const t = useTranslations("gamification")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const top = entries.slice(0, 3)
  if (top.length === 0) return null
  const order = [top[1], top[0], top[2]].filter(Boolean) as BoardEntry[]

  return (
    <div className="flex items-end justify-center gap-2 px-2 pt-4 sm:gap-4">
      {order.map((e) => {
        const style = PODIUM_STYLE[Math.min(e.rank, 3)] ?? PODIUM_STYLE[3]
        return (
          <div key={e.userId} className="flex min-w-0 max-w-[8.5rem] flex-1 flex-col items-center gap-2">
            {e.rank === 1 && <Crown className="h-6 w-6 text-amber-500" aria-hidden="true" />}
            <Avatar className={cn("h-14 w-14 ring-4 sm:h-16 sm:w-16", style.ring)}>
              {e.image ? <AvatarImage src={e.image} alt={e.name ?? ""} className="object-cover" /> : null}
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials(e.name)}</AvatarFallback>
            </Avatar>
            <div className="w-full text-center">
              <p className={cn("truncate text-sm font-semibold", e.isMe && "text-primary")}>
                {e.name || "—"}
                {e.isMe && <span className="ms-1 text-xs font-normal">({t("you")})</span>}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">{t("pointsCount", { count: e.points })}</p>
            </div>
            <div
              className={cn(
                "flex w-full items-start justify-center rounded-t-lg bg-gradient-to-b pt-2 text-lg font-bold text-white shadow-sm",
                style.bar,
                style.height
              )}
            >
              {nf.format(e.rank)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Full ranking list; the viewer's row is highlighted. */
export function LeaderboardList({
  entries,
  me,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: {
  entries: BoardEntry[]
  me?: BoardEntry | null
  title: React.ReactNode
  description?: React.ReactNode
  emptyTitle: string
  emptyDescription?: string
}) {
  const t = useTranslations("gamification")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const meOutside = me && !entries.some((e) => e.userId === me.userId)

  const row = (e: BoardEntry, key?: string) => (
    <li
      key={key ?? e.userId}
      data-testid={e.isMe ? "leaderboard-me" : undefined}
      className={cn(
        "flex items-center gap-3 px-4 py-3 sm:px-6",
        e.isMe && "bg-primary/5 ring-1 ring-inset ring-primary/20"
      )}
    >
      <RankBadge rank={e.rank} />
      <AvatarName
        name={e.name}
        image={e.image}
        size="sm"
        secondary={t("levelShort", { level: nf.format(e.level) })}
        badge={
          e.isMe ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
              {t("you")}
            </span>
          ) : null
        }
        className="flex-1"
      />
      <span className="shrink-0 text-sm font-bold tabular-nums">
        {nf.format(e.points)} <span className="text-xs font-normal text-muted-foreground">{t("pts")}</span>
      </span>
    </li>
  )

  return (
    <SectionCard icon={Trophy} title={title} description={description} contentClassName="p-0">
      {entries.length === 0 ? (
        <EmptyState variant="plain" size="sm" icon={Trophy} title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="divide-y">
          {entries.map((e) => row(e))}
          {meOutside && me && (
            <>
              <li aria-hidden="true" className="py-1 text-center text-muted-foreground">
                ⋯
              </li>
              {row({ ...me, isMe: true }, "me")}
            </>
          )}
        </ul>
      )}
    </SectionCard>
  )
}

/** Small segmented control (works in RTL and LTR). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
