import { getTranslations } from "next-intl/server"
import { CalendarDays } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { EmptyState, PageHeader } from "@/components/shared"
import { WeekTimetable } from "@/components/school/week-timetable"
import { schoolDays } from "@/components/school/format"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("timetable.myTitle") }
}

export default async function StudentTimetablePage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("school")
  const entries = await db.timetableEntry.findMany({
    where: { group: { members: { some: { studentId: session.user.id } } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      subject: true,
      room: true,
      group: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
    },
  })
  const multipleClasses = new Set(entries.map((e) => e.group.id)).size > 1

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarDays} title={t("timetable.myTitle")} description={t("timetable.studentSubtitle")} />
      {entries.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("timetable.emptyStudent")} description={t("timetable.emptyStudentHint")} />
      ) : (
        <WeekTimetable entries={entries} days={schoolDays(false, entries)} show={{ group: multipleClasses, teacher: true }} />
      )}
    </div>
  )
}
