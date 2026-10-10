import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { BookOpen, CalendarDays, CalendarRange, FileText, GraduationCap, Megaphone, School, Users } from "lucide-react"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/shared"
import { intlLocale } from "@/components/school/format"
import { getOrgContext } from "../_context"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("overview.title") }
}

export default async function SchoolOverviewPage({ params }: { params: { orgId: string } }) {
  const { org, isManager } = await getOrgContext(params.orgId)
  const t = await getTranslations("school")
  const locale = await getLocale()
  const nf = new Intl.NumberFormat(intlLocale(locale))
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" })
  const base = `/org/${org.id}/school`

  const [classes, students, teachers, currentTerm, periods, announcements] = await Promise.all([
    db.classGroup.count({ where: { organizationId: org.id } }),
    db.classGroupMember.count({ where: { group: { organizationId: org.id } } }),
    db.organizationMember.count({ where: { organizationId: org.id, role: { in: ["OWNER", "MANAGER", "TEACHER"] } } }),
    db.academicTerm.findFirst({ where: { organizationId: org.id, isCurrent: true } }),
    db.timetableEntry.count({ where: { organizationId: org.id } }),
    db.announcement.findMany({
      where: { organizationId: org.id },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { id: true, title: true, createdAt: true, group: { select: { name: true } } },
    }),
  ])

  const steps = [
    { done: !!currentTerm, label: t("overview.stepTerm"), href: `${base}/terms`, icon: CalendarRange },
    { done: classes > 0, label: t("overview.stepClasses"), href: `/org/${org.id}`, icon: Users },
    { done: periods > 0, label: t("overview.stepTimetable"), href: `${base}/timetable`, icon: CalendarDays },
  ]

  return (
    <div className="space-y-6">
      <PageHeader icon={School} title={t("overview.title")} description={t("overview.subtitle", { name: org.name })} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("overview.classes")} value={nf.format(classes)} icon={Users} />
        <StatCard label={t("overview.students")} value={nf.format(students)} icon={GraduationCap} tone="info" />
        <StatCard label={t("overview.teachers")} value={nf.format(teachers)} icon={BookOpen} tone="success" />
        <StatCard
          label={t("overview.currentTerm")}
          value={currentTerm ? currentTerm.name : "—"}
          hint={currentTerm ? `${dateFmt.format(currentTerm.startsAt)} – ${dateFmt.format(currentTerm.endsAt)}` : undefined}
          icon={CalendarRange}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isManager && steps.some((s) => !s.done) && (
          <SectionCard title={t("overview.setupTitle")} description={t("overview.setupHint")}>
            <ul className="space-y-2">
              {steps.map((s) => (
                <li key={s.href} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    {s.label}
                  </span>
                  {s.done ? (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("overview.done")}</span>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={s.href}>{t("overview.start")}</Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
        <SectionCard
          icon={Megaphone}
          title={t("overview.latestAnnouncements")}
          action={
            <Button size="sm" variant="ghost" asChild>
              <Link href={`${base}/announcements`}>{t("overview.viewAll")}</Link>
            </Button>
          }
          contentClassName="p-0"
        >
          {announcements.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={Megaphone} title={t("announcements.empty")} />
          ) : (
            <ul className="divide-y">
              {announcements.map((a) => (
                <li key={a.id} className="px-4 py-3 sm:px-6">
                  <p className="break-words font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.group?.name ?? t("announcements.wholeSchool")} · {dateFmt.format(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard icon={FileText} title={t("overview.reportCardsTitle")} description={t("overview.reportCardsHint")}>
          <Button asChild>
            <Link href={`${base}/report-cards`}>{t("overview.openReportCards")}</Link>
          </Button>
        </SectionCard>
      </div>
    </div>
  )
}
