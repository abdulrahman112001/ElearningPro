import { getTranslations } from "next-intl/server"
import { SubjectsManager } from "@/components/school/subjects-manager"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("subjects.title") }
}

export default function SchoolSubjectsPage({ params }: { params: { orgId: string } }) {
  return <SubjectsManager orgId={params.orgId} />
}
