import { getTranslations } from "next-intl/server"
import { TimetableEditor } from "@/components/school/timetable-editor"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("timetable.title") }
}

export default function SchoolTimetablePage({ params }: { params: { orgId: string } }) {
  return <TimetableEditor orgId={params.orgId} />
}
