"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MessagesSquare,
  RefreshCw,
  Search,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState, ListSkeleton, SectionCard, StatusBadge } from "@/components/shared"
import { cn, getInitials } from "@/lib/utils"
import {
  ROLE_TONES,
  formatDateTime,
  formatDay,
  formatRelativeTime,
  formatTime,
} from "./activity-meta"

export interface ConversationParticipant {
  id: string
  name: string | null
  email: string
  role: string
  image: string | null
}

export interface ConversationSummary {
  participants: ConversationParticipant[]
  messageCount: number
  lastMessageAt: string
  lastMessage: string
}

interface ConversationsResponse {
  conversations: ConversationSummary[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export function conversationHref(participants: ConversationParticipant[]) {
  const [a, b] = participants.map((p) => p.id).sort()
  return `/admin/conversations/${a}/${b}`
}

/** Two overlapping avatars for a pair of users. */
export function PairAvatars({
  participants,
  size = "md",
}: {
  participants: ConversationParticipant[]
  size?: "sm" | "md"
}) {
  const box = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
  return (
    <div className="flex shrink-0 -space-x-3 rtl:space-x-reverse">
      {participants.slice(0, 2).map((p, i) => (
        <Avatar
          key={p.id}
          className={cn(box, "ring-2 ring-card", i === 1 && "translate-y-1.5")}
        >
          {p.image ? <AvatarImage src={p.image} alt={p.name ?? ""} className="object-cover" /> : null}
          <AvatarFallback
            className={cn(
              "font-semibold",
              i === 0 ? "bg-primary/10 text-primary" : "bg-info/10 text-info"
            )}
          >
            {getInitials(p.name)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  )
}

/** "Name (role) ↔ Name (role)" line. */
export function PairNames({ participants }: { participants: ConversationParticipant[] }) {
  const t = useTranslations("adminConversations")
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {participants.map((p, i) => (
        <span key={p.id} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && (
            <MessagesSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-semibold">{p.name?.trim() || p.email}</span>
          <StatusBadge
            status={p.role}
            tone={ROLE_TONES[p.role] ?? "neutral"}
            label={t(`roles.${p.role}` as "roles.ADMIN")}
            dot={false}
            className="px-1.5 text-[0.6875rem]"
          />
        </span>
      ))}
    </div>
  )
}

export function ConversationRow({
  conversation,
  compact = false,
}: {
  conversation: ConversationSummary
  compact?: boolean
}) {
  const t = useTranslations("adminConversations")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-EG")
  if (conversation.participants.length < 2) return null
  return (
    <li>
      <Link
        href={conversationHref(conversation.participants)}
        className={cn(
          "flex items-start gap-3 px-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:gap-4 sm:px-6",
          compact ? "py-3" : "py-4"
        )}
      >
        <PairAvatars participants={conversation.participants} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <PairNames participants={conversation.participants} />
            <time
              dateTime={new Date(conversation.lastMessageAt).toISOString()}
              title={formatDateTime(conversation.lastMessageAt, locale)}
              suppressHydrationWarning
              className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
            >
              {formatRelativeTime(conversation.lastMessageAt, locale)}
            </time>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-muted-foreground" dir="auto">
              {conversation.lastMessage || "—"}
            </p>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
              title={t("messageCount", { count: conversation.messageCount })}
            >
              <MessageSquare className="h-3 w-3" aria-hidden="true" />
              {nf.format(conversation.messageCount)}
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}

export function ConversationsList() {
  const t = useTranslations("adminConversations")
  const locale = useLocale()
  const nf = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-EG"), [locale])

  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ConversationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(id)
  }, [query])

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    try {
      const sp = new URLSearchParams({ page: String(page) })
      if (debounced) sp.set("q", debounced)
      const res = await fetch(`/api/admin/conversations?${sp}`, { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as ConversationsResponse
      if (id !== requestId.current) return
      setData(json)
      setError(false)
    } catch {
      if (id === requestId.current) setError(true)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [page, debounced])

  useEffect(() => {
    load()
  }, [load])

  const pages = Math.max(1, data?.pagination.pages ?? 1)

  return (
    <SectionCard
      title={t("listTitle")}
      description={
        data ? t("totalCount", { count: data.pagination.total, formatted: nf.format(data.pagination.total) }) : undefined
      }
      icon={MessagesSquare}
      action={
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
          {t("refresh")}
        </Button>
      }
      contentClassName="p-0"
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
      <div className="border-b px-4 py-3 sm:px-6">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
      </div>

      {loading && !data ? (
        <ListSkeleton rows={6} className="rounded-none border-0 shadow-none" />
      ) : error && !data ? (
        <EmptyState
          variant="plain"
          icon={MessagesSquare}
          title={t("loadError")}
          action={
            <Button variant="outline" onClick={load}>
              {t("retry")}
            </Button>
          }
        />
      ) : !data || data.conversations.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={MessagesSquare}
          title={debounced ? t("emptySearch") : t("empty")}
          description={debounced ? t("emptySearchHint") : t("emptyHint")}
        />
      ) : (
        <ul className={cn("divide-y transition-opacity", loading && "opacity-60")}>
          {data.conversations.map((c) => (
            <ConversationRow key={c.participants.map((p) => p.id).join("-")} conversation={c} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

/* ------------------------------------------------------------------ */
/* Read-only thread                                                    */
/* ------------------------------------------------------------------ */

export interface ThreadMessage {
  id: string
  content: string
  fromUserId: string
  toUserId: string
  isRead: boolean
  createdAt: string
}

function dayKey(date: string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function ConversationThread({
  participants,
  messages,
}: {
  /** [start-side user, end-side user] */
  participants: [ConversationParticipant, ConversationParticipant]
  messages: ThreadMessage[]
}) {
  const t = useTranslations("adminConversations")
  const locale = useLocale()
  const endUser = participants[1]
  const byId = new Map(participants.map((p) => [p.id, p]))
  const today = dayKey(new Date().toISOString())
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString())

  if (messages.length === 0) {
    return <EmptyState variant="plain" icon={MessagesSquare} title={t("threadEmpty")} />
  }

  return (
    <ol className="space-y-3" aria-label={t("threadLabel")}>
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
        const sameSenderAsPrev = !newDay && prev?.fromUserId === m.fromUserId
        const isEnd = m.fromUserId === endUser.id
        const sender = byId.get(m.fromUserId)
        const key = dayKey(m.createdAt)
        const dayLabel =
          key === today ? t("today") : key === yesterday ? t("yesterday") : formatDay(m.createdAt, locale)
        return (
          <li key={m.id} className="space-y-3">
            {newDay && (
              <div className="flex items-center gap-3 py-2" aria-hidden={false}>
                <span className="h-px flex-1 bg-border" />
                <span
                  suppressHydrationWarning
                  className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {dayLabel}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <div className={cn("flex items-end gap-2", isEnd ? "flex-row-reverse" : "flex-row")}>
              <div className="w-8 shrink-0">
                {!sameSenderAsPrev && sender && (
                  <Avatar className="h-8 w-8 ring-2 ring-card">
                    {sender.image ? (
                      <AvatarImage src={sender.image} alt={sender.name ?? ""} className="object-cover" />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        "text-xs font-semibold",
                        isEnd ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                      )}
                    >
                      {getInitials(sender.name)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div
                className={cn(
                  "flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]",
                  isEnd ? "items-end" : "items-start"
                )}
              >
                {!sameSenderAsPrev && (
                  <span className="px-1 text-xs font-medium text-muted-foreground">
                    {sender?.name?.trim() || sender?.email || t("unknownUser")}
                  </span>
                )}
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                    isEnd
                      ? "rounded-ee-md bg-primary text-primary-foreground"
                      : "rounded-es-md border bg-card text-card-foreground"
                  )}
                  dir="auto"
                >
                  {m.content}
                </div>
                <div className="flex items-center gap-1 px-1 text-[0.6875rem] text-muted-foreground">
                  <time
                    dateTime={m.createdAt}
                    title={formatDateTime(m.createdAt, locale)}
                    suppressHydrationWarning
                    className="tabular-nums"
                  >
                    {formatTime(m.createdAt, locale)}
                  </time>
                  <span aria-hidden="true">·</span>
                  {m.isRead ? (
                    <span className="inline-flex items-center gap-0.5 text-info">
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("read")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("unread")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
