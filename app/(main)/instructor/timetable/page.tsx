import { getLocale, getTranslations } from "next-intl/server"
import { CalendarDays, Clock, Layers, Users } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseTime } from "@/lib/school"
import { EmptyState, PageHeader, StatCard } from "@/components/shared"
import { WeekTimetable } from "@/components/school/week-timetable"
import { intlLocale, schoolDays } from "@/components/school/format"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("timetable.teachingTitle") }
}

export default async function InstructorTimetablePage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("school")
  const locale = await getLocale()
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 })
  const entries = await db.timetableEntry.findMany({
    where: { teacherId: session.user.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      subject: true,
      room: true,
      group: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true } },
    },
  })
  const minutes = entries.reduce((s, e) => s + Math.max(0, (parseTime(e.endTime) ?? 0) - (parseTime(e.startTime) ?? 0)), 0)
  const orgCount = new Set(entries.map((e) => e.organization.id)).size

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarDays} title={t("timetable.teachingTitle")} description={t("timetable.teachingSubtitle")} />
      {entries.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("timetable.emptyTeacher")} description={t("timetable.emptyTeacherHint")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard label={t("timetable.statPeriods")} value={nf.format(entries.length)} icon={Layers} />
            <StatCard label={t("timetable.statHours")} value={nf.format(minutes / 60)} icon={Clock} tone="info" />
            <StatCard label={t("timetable.statClasses")} value={nf.format(new Set(entries.map((e) => e.group.id)).size)} icon={Users} tone="success" />
          </div>
          <WeekTimetable entries={entries} days={schoolDays(false, entries)} show={{ group: true, teacher: false, organization: orgCount > 1 }} />
        </>
      )}
    </div>
  )
}
