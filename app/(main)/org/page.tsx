import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Building2, Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared"
import { OrgLogo } from "@/components/organizations/org-logo"

export async function generateMetadata() {
  const t = await getTranslations("organizations")
  return { title: t("mine.title") }
}

export default async function MyOrganizationsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/org")
  const t = await getTranslations("organizations")
  const canCreate =
    session.user.role === "ADMIN" || (session.user.role === "INSTRUCTOR" && session.user.instructorApproved)

  const memberships = await db.organizationMember.findMany({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      organization: {
        select: {
          id: true, name: true, slug: true, type: true, logoUrl: true, primaryColor: true,
          isApproved: true, isActive: true, governorate: true,
          _count: { select: { members: true, classGroups: true } },
        },
      },
    },
  })

  return (
    <div className="container max-w-5xl px-4 py-8">
      <PageHeader
        icon={Building2}
        title={t("mine.title")}
        description={t("mine.subtitle")}
        actions={
          canCreate ? (
            <Button asChild className="gap-2">
              <Link href="/org/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("mine.create")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {memberships.length === 0 ? (
        <EmptyState icon={Building2} title={t("mine.empty")} description={canCreate ? t("mine.emptyHintTeacher") : t("mine.emptyHint")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {memberships.map(({ role, organization: o }) => (
            <li key={o.id}>
              <Link
                href={`/org/${o.id}`}
                className="flex min-w-0 items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <OrgLogo name={o.name} logoUrl={o.logoUrl} color={o.primaryColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(`types.${o.type}`)} · {t(`roles.${role}`)}
                    {o.governorate ? ` · ${o.governorate}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("mine.counts", { members: o._count.members, classes: o._count.classGroups })}
                  </p>
                </div>
                <StatusBadge
                  status={!o.isActive ? "SUSPENDED" : o.isApproved ? "APPROVED" : "PENDING"}
                  label={!o.isActive ? t("status.suspendedShort") : o.isApproved ? t("status.approvedShort") : t("status.pendingShort")}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
