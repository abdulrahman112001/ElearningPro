import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { FileText, Mail, MessageCircle, Settings } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { WEEKLY_TEMPLATE } from "@/lib/reports/weekly-report"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/shared"

export async function generateMetadata() {
  const t = await getTranslations("parent.reports")
  return { title: t("title") }
}

export default async function ParentReportsPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("parent.reports")
  const locale = await getLocale()
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "full", timeStyle: "short" })

  const deliveries = await db.messageDelivery.findMany({
    where: { userId: session.user.id, template: WEEKLY_TEMPLATE },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, channel: true, to: true, body: true, status: true, createdAt: true },
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        icon={FileText}
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild variant="outline">
            <Link href="/parent/settings">
              <Settings aria-hidden="true" />
              {t("manage")}
            </Link>
          </Button>
        }
      />

      {deliveries.length === 0 ? (
        <EmptyState icon={FileText} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <SectionCard title={t("listTitle")} contentClassName="p-0">
          <ul className="divide-y">
            {deliveries.map((d) => {
              const Icon = d.channel === "EMAIL" ? Mail : MessageCircle
              return (
                <li key={d.id} className="px-4 py-3 sm:px-6">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{t(`channel.${d.channel === "EMAIL" ? "EMAIL" : "WHATSAPP"}`)}</span>
                          <span className="block text-xs text-muted-foreground">{dateFmt.format(d.createdAt)}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge status={d.status === "FAILED" ? "FAILED" : "COMPLETED"} label={t(`status.${d.status === "FAILED" ? "FAILED" : "SENT"}`)} />
                        <span className="text-xs text-primary group-open:hidden">{t("show")}</span>
                        <span className="hidden text-xs text-primary group-open:inline">{t("hide")}</span>
                      </span>
                    </summary>
                    {d.channel === "EMAIL" ? (
                      <p className="mt-3 text-sm text-muted-foreground">{t("emailSentTo", { email: d.to })}</p>
                    ) : (
                      <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-sans text-sm leading-relaxed">
                        {d.body}
                      </pre>
                    )}
                  </details>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}
