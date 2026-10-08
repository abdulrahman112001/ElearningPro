"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import {
  Activity,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  ListFilter,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AvatarName,
  EmptyState,
  ListSkeleton,
  SectionCard,
  StatCard,
  StatusBadge,
  toneStyles,
} from "@/components/shared"
import { cn } from "@/lib/utils"
import {
  ACTIVITY_CATEGORIES,
  ROLE_TONES,
  activityEntityHref,
  adminUserHref,
  formatDateTime,
  formatDay,
  formatRelativeTime,
  getActionMeta,
  isKnownAction,
  type ActivityItem,
} from "./activity-meta"

/* ------------------------------------------------------------------ */
/* Row + list (also used by the admin dashboard's "Recent activity")   */
/* ------------------------------------------------------------------ */

function RelativeTime({ date }: { date: string | Date }) {
  const locale = useLocale()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const iso = new Date(date).toISOString()
  return (
    <time
      dateTime={iso}
      title={formatDateTime(date, locale)}
      suppressHydrationWarning
      className="shrink-0 cursor-help whitespace-nowrap text-xs tabular-nums text-muted-foreground"
    >
      {formatRelativeTime(date, locale, now)}
    </time>
  )
}

export function ActivityRow({
  item,
  isLast = false,
  compact = false,
}: {
  item: ActivityItem
  isLast?: boolean
  compact?: boolean
}) {
  const t = useTranslations("adminActivity")
  const meta = getActionMeta(item.action)
  const Icon = meta.icon
  const label = isKnownAction(item.action)
    ? t(`actions.${item.action}` as "actions.user.login")
    : item.action
  const href = activityEntityHref(item)
  const role = item.actor?.role ?? item.actorRole ?? null

  return (
    <li className={cn("relative flex gap-3 sm:gap-4", compact ? "py-3" : "py-4")}>
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 start-[1.1875rem] top-12 w-px bg-border"
        />
      )}
      <div
        className={cn(
          "relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          toneStyles[meta.tone].icon
        )}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold leading-snug">{label}</p>
          <RelativeTime date={item.createdAt} />
        </div>

        {item.summary && (
          <p
            className={cn(
              "break-words text-sm leading-relaxed text-muted-foreground",
              compact ? "line-clamp-1" : "line-clamp-2"
            )}
            dir="auto"
          >
            {item.summary}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {item.actor ? (
            <Link
              href={adminUserHref(item.actor)}
              className="min-w-0 max-w-full rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <AvatarName
                size="sm"
                name={item.actor.name}
                image={item.actor.image}
                secondary={compact ? undefined : item.actor.email}
                badge={
                  role ? (
                    <StatusBadge
                      status={role}
                      tone={ROLE_TONES[role] ?? "neutral"}
                      label={t(`roles.${role}` as "roles.ADMIN")}
                      dot={false}
                      className="px-1.5 text-[0.6875rem]"
                    />
                  ) : null
                }
              />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              {t("system")}
            </span>
          )}
          {href && (
            <Link
              href={href}
              className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {t("openRelated")}
              <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}

/** Plain timeline list without day headers (dashboard widget). */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="divide-y divide-transparent">
      {items.map((item, i) => (
        <ActivityRow key={item.id} item={item} compact isLast={i === items.length - 1} />
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Full feed                                                           */
/* ------------------------------------------------------------------ */

interface FeedResponse {
  items: ActivityItem[]
  pagination: { page: number; limit: number; total: number; pages: number }
  stats: { last24h: number }
}

const PAGE_SIZE = 30
const POLL_MS = 30_000
const ALL = "all"

function dayKey(date: string | Date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function ActivityFeed() {
  const t = useTranslations("adminActivity")
  const locale = useLocale()
  const nf = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-EG"), [locale])

  const [category, setCategory] = useState<string>(ALL)
  const [role, setRole] = useState<string>(ALL)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const [data, setData] = useState<FeedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const requestId = useRef(0)

  // Debounce free-text search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => clearTimeout(id)
  }, [query])

  // Any filter change returns to the first page
  useEffect(() => {
    setPage(1)
  }, [category, role, debouncedQuery, from, to])

  const params = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (category !== ALL) sp.set("action", category)
    if (role !== ALL) sp.set("role", role)
    if (debouncedQuery) sp.set("q", debouncedQuery)
    if (from) sp.set("from", new Date(`${from}T00:00:00`).toISOString())
    if (to) sp.set("to", new Date(`${to}T23:59:59.999`).toISOString())
    return sp.toString()
  }, [page, category, role, debouncedQuery, from, to])

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await fetch(`/api/admin/activity?${params}`, { cache: "no-store" })
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as FeedResponse
        if (id !== requestId.current) return
        setData(json)
        setError(false)
        setUpdatedAt(new Date())
      } catch {
        if (id === requestId.current) setError(true)
      } finally {
        if (id === requestId.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [params]
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  const hasFilters = category !== ALL || role !== ALL || query !== "" || from !== "" || to !== ""
  const clearFilters = () => {
    setCategory(ALL)
    setRole(ALL)
    setQuery("")
    setFrom("")
    setTo("")
  }

  // Group rows by calendar day for an organised timeline
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: ActivityItem[] }[] = []
    const today = dayKey(new Date())
    const yesterday = dayKey(new Date(Date.now() - 86_400_000))
    for (const item of data?.items ?? []) {
      const key = dayKey(item.createdAt)
      let group = out[out.length - 1]
      if (!group || group.key !== key) {
        const label =
          key === today ? t("today") : key === yesterday ? t("yesterday") : formatDay(item.createdAt, locale)
        group = { key, label, items: [] }
        out.push(group)
      }
      group.items.push(item)
    }
    return out
  }, [data, locale, t])

  const pagination = data?.pagination
  const pages = Math.max(1, pagination?.pages ?? 1)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label={t("last24h")}
          value={data ? nf.format(data.stats.last24h) : "—"}
          icon={Clock}
          tone="primary"
          hint={t("last24hHint")}
        />
        <StatCard
          label={t("matching")}
          value={pagination ? nf.format(pagination.total) : "—"}
          icon={ListFilter}
          tone="info"
          hint={hasFilters ? t("matchingFiltered") : t("matchingAll")}
        />
        <div className="col-span-2 flex flex-col justify-between gap-3 rounded-lg border bg-card p-4 shadow-soft sm:p-5 lg:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label htmlFor="activity-auto-refresh" className="text-sm font-medium">
                {t("autoRefresh")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("autoRefreshHint")}</p>
            </div>
            <Switch
              id="activity-auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full",
                  autoRefresh ? "animate-pulse bg-success" : "bg-muted-foreground/40"
                )}
              />
              {updatedAt
                ? t("updatedAt", { time: formatDateTime(updatedAt, locale) })
                : t("loadingShort")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
                aria-hidden="true"
              />
              {t("refresh")}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <SectionCard
        title={t("filters")}
        icon={ListFilter}
        action={
          hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden="true" />
              {t("clearFilters")}
            </Button>
          ) : null
        }
        contentClassName="space-y-4"
      >
        <div
          role="group"
          aria-label={t("category")}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {[{ key: ALL, prefix: ALL, icon: Layers }, ...ACTIVITY_CATEGORIES].map((c) => {
            const active = category === c.prefix
            const CatIcon = c.icon
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.prefix)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(`categories.${c.key}` as "categories.all")}
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="activity-search" className="text-xs text-muted-foreground">
              {t("search")}
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="activity-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger aria-label={t("role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allRoles")}</SelectItem>
                <SelectItem value="ADMIN">{t("roles.ADMIN")}</SelectItem>
                <SelectItem value="INSTRUCTOR">{t("roles.INSTRUCTOR")}</SelectItem>
                <SelectItem value="STUDENT">{t("roles.STUDENT")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
            <div className="space-y-1.5">
              <Label htmlFor="activity-from" className="text-xs text-muted-foreground">
                {t("from")}
              </Label>
              <Input
                id="activity-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-to" className="text-xs text-muted-foreground">
                {t("to")}
              </Label>
              <Input
                id="activity-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Timeline */}
      {loading && !data ? (
        <ListSkeleton rows={8} />
      ) : error && !data ? (
        <EmptyState
          icon={Activity}
          title={t("loadError")}
          action={
            <Button variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("retry")}
            </Button>
          }
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={hasFilters ? t("emptyFiltered") : t("empty")}
          description={hasFilters ? t("emptyFilteredHint") : t("emptyHint")}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SectionCard
          title={t("timeline")}
          icon={Activity}
          contentClassName={cn("p-0 transition-opacity", loading && "opacity-60")}
          footer={
            pages > 1 ? (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
                  {t("previous")}
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("pageOf", { page: nf.format(page), pages: nf.format(pages) })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages || loading}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  {t("next")}
                  <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
                </Button>
              </div>
            ) : undefined
          }
        >
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="sticky top-0 z-[2] border-b bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground backdrop-blur sm:px-6">
                {group.label}
              </h3>
              <ol className="px-4 sm:px-6">
                {group.items.map((item, i) => (
                  <ActivityRow key={item.id} item={item} isLast={i === group.items.length - 1} />
                ))}
              </ol>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  )
}
