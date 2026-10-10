import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Building2, ExternalLink, Megaphone } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, SectionCard } from "@/components/shared"
import { OrgLogo } from "@/components/organizations/org-logo"
import { ClassCard } from "@/components/organizations/class-card"

export async function generateMetadata() {
  const t = await getTranslations("organizations")
  return { title: t("student.title") }
}

export default async function StudentOrganizationsPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("organizations")
  const locale = await getLocale()

  const memberships = await db.organizationMember.findMany({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      organization: {
        select: {
          id: true, name: true, slug: true, type: true, logoUrl: true, primaryColor: true,
          isApproved: true, isActive: true,
          classGroups: {
            where:
              // Students see the classes they're in; staff see the ones they teach.
              { OR: [{ members: { some: { studentId: session.user.id } } }, { instructorId: session.user.id }] },
            orderBy: { createdAt: "asc" },
            select: {
              id: true, name: true, mode: true, location: true, monthlyFee: true, capacity: true, instructorId: true,
              instructor: { select: { name: true } },
              gradeLevel: { select: { nameAr: true, nameEn: true } },
              scheduleSlots: { select: { dayOfWeek: true, startTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
              _count: { select: { members: true } },
            },
          },
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader icon={Building2} title={t("student.title")} description={t("student.subtitle")} />
      {memberships.length === 0 ? (
        <EmptyState icon={Building2} title={t("student.empty")} description={t("student.emptyHint")} />
      ) : (
        memberships.map(({ role, organization: o }) => (
          <SectionCard
            key={o.id}
            title={
              <span className="flex min-w-0 items-center gap-3">
                <OrgLogo name={o.name} logoUrl={o.logoUrl} color={o.primaryColor} className="h-9 w-9 text-sm" />
                <span className="truncate">{o.name}</span>
              </span>
            }
            description={`${t(`types.${o.type}`)} · ${t(`roles.${role}`)}`}
            action={
              <div className="flex flex-wrap gap-2">
                {o.type === "SCHOOL" && (
                  <Button asChild size="sm" variant="ghost" className="gap-1">
                    <Link href={`/org/${o.id}/school/announcements`}>
                      <Megaphone className="h-4 w-4" aria-hidden="true" />
                      {t("overview.announcements")}
                    </Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/org/${o.id}`}>{t("student.open")}</Link>
                </Button>
                {o.isApproved && o.isActive && (
                  <Button asChild size="sm" variant="ghost" className="gap-1">
                    <Link href={`/o/${o.slug}`}>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t("overview.publicPage")}
                    </Link>
                  </Button>
                )}
              </div>
            }
          >
            {o.classGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("student.noClasses")}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {o.classGroups.map((c) => (
                  <ClassCard
                    key={c.id}
                    locale={locale}
                    showManageLinks={c.instructorId === session.user.id}
                    group={{
                      id: c.id,
                      name: c.name,
                      mode: c.mode,
                      location: c.location,
                      monthlyFee: c.monthlyFee,
                      capacity: c.capacity,
                      members: c._count.members,
                      teacher: c.instructor.name,
                      grade: c.gradeLevel ? (locale === "ar" ? c.gradeLevel.nameAr : c.gradeLevel.nameEn) : null,
                      slots: c.scheduleSlots,
                    }}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        ))
      )}
    </div>
  )
}
