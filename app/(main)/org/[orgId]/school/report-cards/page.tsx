import { getTranslations } from "next-intl/server"
import { ReportCardsPicker } from "@/components/school/report-cards"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("reportCards.title") }
}

export default function SchoolReportCardsPage({ params }: { params: { orgId: string } }) {
  return <ReportCardsPicker orgId={params.orgId} />
}
