import { getLocale, getTranslations } from "next-intl/server"
import { Lock, Mail, MessageSquare, MessagesSquare } from "lucide-react"
import { db } from "@/lib/db"
import { PageHeader, StatCard } from "@/components/shared"
import { ConversationsList } from "@/components/admin/conversations-list"

export async function generateMetadata() {
  const t = await getTranslations("adminConversations")
  return { title: t("title") }
}

// Auth/role is enforced by app/(main)/admin/layout.tsx and the API routes.
export default async function AdminConversationsPage() {
  const t = await getTranslations("adminConversations")
  const ta = await getTranslations("admin")

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [totalMessages, messages24h, unread] = await Promise.all([
    db.message.count(),
    db.message.count({ where: { createdAt: { gte: since } } }),
    db.message.count({ where: { isRead: false } }),
  ])
  const locale = await getLocale()
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-EG")
  const fmt = (n: number) => nf.format(n)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessagesSquare}
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: ta("adminPanel"), href: "/admin" }, { label: t("title") }]}
        className="mb-0 sm:mb-0"
      />

      <div className="flex items-start gap-3 rounded-lg border border-info/20 bg-info/5 p-4 text-sm">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        <p className="text-muted-foreground">{t("oversightNotice")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label={t("totalMessages")} value={fmt(totalMessages)} icon={MessageSquare} tone="primary" />
        <StatCard
          label={t("messages24h")}
          value={fmt(messages24h)}
          icon={MessagesSquare}
          tone="info"
          hint={t("last24hHint")}
        />
        <StatCard
          label={t("unreadMessages")}
          value={fmt(unread)}
          icon={Mail}
          tone="warning"
          hint={t("unreadHint")}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <ConversationsList />
    </div>
  )
}
