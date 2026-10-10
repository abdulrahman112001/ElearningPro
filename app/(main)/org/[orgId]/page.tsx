import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import {
  BookOpen,
  Building2,
  ExternalLink,
  GraduationCap,
  Mail,
  Megaphone,
  Presentation,
  ShieldCheck,
  UsersRound,
} from "lucide-react"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/shared"
import { ClassCard } from "@/components/organizations/class-card"
import { getOrgContext } from "./_context"

export async function generateMetadata({ params }: { params: { orgId: string } }) {
  const { org } = await getOrgContext(params.orgId)
  return { title: org.name }
}

export default async function OrgOverviewPage({ params }: { params: { orgId: string } }) {
  const { org, role, isManager, session } = await getOrgContext(params.orgId)
  const t = await getTranslations("organizations")
  const locale = await getLocale()
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")

  const classWhere =
    isManager
      ? { organizationId: org.id }
      : role === "TEACHER"
        ? { organizationId: org.id, instructorId: session.user.id }
        : { organizationId: org.id, members: { some: { studentId: session.user.id } } }

  const [byRole, classCount, courseCount, pendingInvites, classes] = await Promise.all([
    db.organizationMember.groupBy({ by: ["role"], where: { organizationId: org.id }, _count: { _all: true } }),
    db.classGroup.count({ where: { organizationId: org.id } }),
    db.course.count({ where: { organizationId: org.id } }),
    isManager
      ? db.organizationInvite.count({ where: { organizationId: org.id, acceptedAt: null, expiresAt: { gt: new Date() } } })
      : Promise.resolve(0),
    db.classGroup.findMany({
      where: classWhere,
      orderBy: { createdAt: "desc" },
      take: isManager ? 6 : 50,
      include: {
        instructor: { select: { name: true } },
        gradeLevel: { select: { nameAr: true, nameEn: true } },
        _count: { select: { members: true } },
        scheduleSlots: { select: { dayOfWeek: true, startTime: true } },
      },
    }),
  ])
  const count = (r: string) => byRole.find((b) => b.role === r)?._count._all ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title={org.name}
        description={`${t(`types.${org.type}`)} · ${t(`roles.${role}`)}`}
        actions={
          org.isApproved && org.isActive ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/o/${org.slug}`} target="_blank">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("overview.publicPage")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {isManager && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("overview.students")} value={nf.format(count("STUDENT"))} icon={GraduationCap} tone="primary" />
            <StatCard
              label={t("overview.staff")}
              value={nf.format(count("OWNER") + count("MANAGER") + count("TEACHER"))}
              icon={Presentation}
              tone="info"
              hint={t("overview.staffHint", { managers: count("OWNER") + count("MANAGER"), teachers: count("TEACHER") })}
            />
            <StatCard label={t("overview.classes")} value={nf.format(classCount)} icon={UsersRound} tone="success" />
            <StatCard label={t("overview.courses")} value={nf.format(courseCount)} icon={BookOpen} tone="warning" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard icon={Mail} title={t("overview.pendingInvites")} action={
              <Button asChild size="sm" variant="ghost"><Link href={`/org/${org.id}/invites`}>{t("overview.manage")}</Link></Button>
            }>
              <p className="text-3xl font-bold tabular-nums">{nf.format(pendingInvites)}</p>
            </SectionCard>
            <SectionCard icon={ShieldCheck} title={t("overview.status")}>
              <p className="text-sm text-muted-foreground">
                {!org.isActive ? t("status.suspended") : org.isApproved ? t("status.approved") : t("status.pending")}
              </p>
              <p className="mt-2 break-all text-xs text-muted-foreground" dir="ltr">/o/{org.slug}</p>
            </SectionCard>
          </div>
        </>
      )}

      <SectionCard
        icon={UsersRound}
        title={isManager ? t("overview.latestClasses") : t("overview.myClasses")}
        action={
          isManager || role === "TEACHER" ? (
            <Button asChild size="sm" variant="ghost"><Link href={`/org/${org.id}/classes`}>{t("overview.seeAll")}</Link></Button>
          ) : undefined
        }
      >
        {classes.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={UsersRound} title={t("classes.empty")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                locale={locale}
                showManageLinks={isManager || c.instructorId === session.user.id}
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

      {role === "STUDENT" && org.type === "SCHOOL" && (
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/org/${org.id}/school/announcements`}>
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            {t("overview.announcements")}
          </Link>
        </Button>
      )}
    </div>
  )
}
