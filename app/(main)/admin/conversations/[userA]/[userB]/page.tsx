import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowUpRight, Eye, Lock, MessagesSquare } from "lucide-react"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { AvatarName, PageHeader, SectionCard, StatusBadge } from "@/components/shared"
import { ConversationThread } from "@/components/admin/conversations-list"
import { ROLE_TONES, adminUserHref } from "@/components/admin/activity-meta"

const MAX_MESSAGES = 1000

export async function generateMetadata() {
  const t = await getTranslations("adminConversations")
  return { title: t("threadTitle") }
}

// Auth/role is enforced by app/(main)/admin/layout.tsx. Read-only: viewing a
// thread never marks messages as read or notifies the participants.
export default async function AdminConversationThreadPage({
  params,
}: {
  params: { userA: string; userB: string }
}) {
  const t = await getTranslations("adminConversations")
  const ta = await getTranslations("admin")
  const { userA, userB } = params
  if (userA === userB) notFound()

  const [users, latest] = await Promise.all([
    db.user.findMany({
      where: { id: { in: [userA, userB] } },
      select: { id: true, name: true, email: true, image: true, role: true },
    }),
    db.message.findMany({
      where: {
        OR: [
          { fromUserId: userA, toUserId: userB },
          { fromUserId: userB, toUserId: userA },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: MAX_MESSAGES,
      select: { id: true, content: true, fromUserId: true, toUserId: true, isRead: true, createdAt: true },
    }),
  ])
  const first = users.find((u) => u.id === userA)
  const second = users.find((u) => u.id === userB)
  if (!first || !second) notFound()

  const messages = latest.reverse()
  const participants = [first, second] as const
  const unread = messages.filter((m) => !m.isRead).length

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessagesSquare}
        title={t("threadTitle")}
        description={t("threadDescription")}
        breadcrumbs={[
          { label: ta("adminPanel"), href: "/admin" },
          { label: t("title"), href: "/admin/conversations" },
          { label: t("threadTitle") },
        ]}
        className="mb-0 sm:mb-0"
      />

      <div
        role="note"
        className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm"
      >
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="font-semibold text-amber-800 dark:text-amber-300">{t("readOnlyTitle")}</p>
          <p className="text-muted-foreground">{t("readOnlyBody")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-soft"
          >
            <AvatarName
              size="lg"
              name={p.name}
              image={p.image}
              secondary={<span dir="ltr">{p.email}</span>}
              badge={
                <StatusBadge
                  status={p.role}
                  tone={ROLE_TONES[p.role] ?? "neutral"}
                  label={t(`roles.${p.role}`)}
                  dot={false}
                />
              }
              className="flex-1"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t("sentCount", {
                  count: messages.filter((m) => m.fromUserId === p.id).length,
                })}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href={adminUserHref(p)}>
                  {t("viewUser")}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <SectionCard
        title={t("messagesTitle")}
        description={t("threadStats", { total: messages.length, unread })}
        icon={Eye}
        contentClassName="bg-muted/20"
      >
        <ConversationThread
          participants={[participants[0], participants[1]]}
          messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        />
        {messages.length >= MAX_MESSAGES && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("truncated", { count: MAX_MESSAGES })}
          </p>
        )}
      </SectionCard>
    </div>
  )
}
