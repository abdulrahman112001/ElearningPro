import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { CheckCircle2, FileText, MessagesSquare, Send, XCircle } from "lucide-react"
import { DELIVERY_CHANNELS, DELIVERY_STATUSES, queryDeliveries } from "@/lib/reports/deliveries"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/shared"
import { AdminMessagingActions } from "@/components/parent/admin-messaging-actions"

export async function generateMetadata() {
  const t = await getTranslations("parent.admin")
  return { title: t("title") }
}

interface PageProps {
  searchParams: { channel?: string; template?: string; status?: string; page?: string }
}

const STATUS_BADGE: Record<string, string> = { SENT: "COMPLETED", LOGGED: "PENDING", FAILED: "FAILED" }

// Auth/role is enforced by app/(main)/admin/layout.tsx and the API routes.
export default async function AdminMessagingPage({ searchParams }: PageProps) {
  const t = await getTranslations("parent.admin")
  const ta = await getTranslations("admin")
  const locale = await getLocale()
  const numFmt = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })

  const data = await queryDeliveries({
    channel: searchParams.channel,
    template: searchParams.template,
    status: searchParams.status,
    page: Number(searchParams.page ?? 1),
  })
  const pageHref = (p: number) => {
    const sp = new URLSearchParams()
    for (const k of ["channel", "template", "status"] as const) if (searchParams[k]) sp.set(k, searchParams[k]!)
    sp.set("page", String(p))
    return `/admin/messaging?${sp.toString()}`
  }
  const selectCls =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        icon={MessagesSquare}
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: ta("adminPanel"), href: "/admin" }, { label: t("title") }]}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label={t("counts.SENT")} value={numFmt.format(data.counts.SENT ?? 0)} icon={CheckCircle2} tone="success" hint={t("last30")} />
        <StatCard label={t("counts.LOGGED")} value={numFmt.format(data.counts.LOGGED ?? 0)} icon={FileText} tone="info" hint={t("last30")} />
        <StatCard
          className="col-span-2 lg:col-span-1"
          label={t("counts.FAILED")}
          value={numFmt.format(data.counts.FAILED ?? 0)}
          icon={XCircle}
          tone="danger"
          hint={t("last30")}
        />
      </div>

      <AdminMessagingActions />

      <SectionCard icon={Send} title={t("logTitle")} description={t("logTotal", { count: data.total })} contentClassName="p-0">
        <form method="get" className="grid gap-3 border-b p-4 sm:grid-cols-4 sm:px-6">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t("filters.channel")}</span>
            <select name="channel" defaultValue={searchParams.channel ?? ""} className={selectCls}>
              <option value="">{t("filters.all")}</option>
              {DELIVERY_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {t(`channel.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t("filters.template")}</span>
            <select name="template" defaultValue={searchParams.template ?? ""} className={selectCls}>
              <option value="">{t("filters.all")}</option>
              {data.templates.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t("filters.status")}</span>
            <select name="status" defaultValue={searchParams.status ?? ""} className={selectCls}>
              <option value="">{t("filters.all")}</option>
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`counts.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1">
              {t("filters.apply")}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin/messaging">{t("filters.reset")}</Link>
            </Button>
          </div>
        </form>

        {data.items.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={MessagesSquare} title={t("empty")} />
        ) : (
          <ul className="divide-y">
            {data.items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span>{t(`channel.${(DELIVERY_CHANNELS as readonly string[]).includes(d.channel) ? d.channel : "WHATSAPP"}`)}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{d.template}</span>
                  </p>
                  <p className="break-all text-xs text-muted-foreground" dir="ltr">
                    {d.to}
                    {d.user ? ` · ${d.user.name ?? d.user.email}` : ""}
                  </p>
                  {d.error && <p className="break-words text-xs text-destructive">{d.error}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={STATUS_BADGE[d.status] ?? d.status} label={t(`counts.${d.status in STATUS_BADGE ? d.status : "FAILED"}`)} />
                  <span className="text-xs text-muted-foreground">{dateFmt.format(d.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm sm:px-6">
            <Button asChild variant="outline" size="sm" disabled={data.page <= 1}>
              <Link href={pageHref(Math.max(1, data.page - 1))} aria-disabled={data.page <= 1}>
                {t("prev")}
              </Link>
            </Button>
            <span className="text-muted-foreground">{t("pageOf", { page: data.page, pages: data.pages })}</span>
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(Math.min(data.pages, data.page + 1))} aria-disabled={data.page >= data.pages}>
                {t("next")}
              </Link>
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
