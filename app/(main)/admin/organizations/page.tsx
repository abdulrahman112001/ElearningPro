import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Building2, CheckCircle2, Clock, PauseCircle } from "lucide-react"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/shared"
import { OrgLogo } from "@/components/organizations/org-logo"
import { AdminOrgActions } from "@/components/organizations/admin-org-actions"

export async function generateMetadata() {
  const t = await getTranslations("organizations")
  return { title: t("admin.title") }
}

const FILTERS = ["pending", "approved", "suspended", "all"] as const
type Filter = (typeof FILTERS)[number]

// Auth/role is enforced by app/(main)/admin/layout.tsx and the API routes.
export default async function AdminOrganizationsPage({ searchParams }: { searchParams: { status?: string } }) {
  const t = await getTranslations("organizations")
  const ta = await getTranslations("admin")
  const locale = await getLocale()
  const filter: Filter = FILTERS.includes(searchParams.status as Filter) ? (searchParams.status as Filter) : "pending"
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const df = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" })

  const where =
    filter === "pending"
      ? { isApproved: false, isActive: true }
      : filter === "approved"
        ? { isApproved: true, isActive: true }
        : filter === "suspended"
          ? { isActive: false }
          : {}

  const [orgs, pending, approved, suspended] = await Promise.all([
    db.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { members: true, classGroups: true, courses: true } },
      },
    }),
    db.organization.count({ where: { isApproved: false, isActive: true } }),
    db.organization.count({ where: { isApproved: true, isActive: true } }),
    db.organization.count({ where: { isActive: false } }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title={t("admin.title")}
        description={t("admin.subtitle")}
        breadcrumbs={[{ label: ta("adminPanel"), href: "/admin" }, { label: t("admin.title") }]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("status.pendingShort")} value={nf.format(pending)} icon={Clock} tone="warning" />
        <StatCard label={t("status.approvedShort")} value={nf.format(approved)} icon={CheckCircle2} tone="success" />
        <StatCard label={t("status.suspendedShort")} value={nf.format(suspended)} icon={PauseCircle} tone="danger" />
      </div>

      <nav aria-label={t("admin.filter")} className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/organizations?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              f === filter ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted"
            )}
          >
            {t(`admin.filters.${f}`)}
          </Link>
        ))}
      </nav>

      {orgs.length === 0 ? (
        <EmptyState icon={Building2} title={t("admin.empty")} />
      ) : (
        <ul className="space-y-3">
          {orgs.map((o) => (
            <li key={o.id} className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <OrgLogo name={o.name} logoUrl={o.logoUrl} color={o.primaryColor} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(`types.${o.type}`)} · <span dir="ltr">/o/{o.slug}</span> · {df.format(o.createdAt)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("admin.owner")}: {o.owner.name ?? ""} <span dir="ltr">({o.owner.email})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.counts", { members: o._count.members, classes: o._count.classGroups, courses: o._count.courses })}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={!o.isActive ? "SUSPENDED" : o.isApproved ? "APPROVED" : "PENDING"}
                label={!o.isActive ? t("status.suspendedShort") : o.isApproved ? t("status.approvedShort") : t("status.pendingShort")}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/org/${o.id}`} className="text-sm text-primary hover:underline">{t("admin.open")}</Link>
                <AdminOrgActions orgId={o.id} isApproved={o.isApproved} isActive={o.isActive} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
