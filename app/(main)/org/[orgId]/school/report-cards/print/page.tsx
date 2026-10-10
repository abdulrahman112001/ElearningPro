import { getTranslations } from "next-intl/server"
import { PrintableReportCards } from "@/components/school/report-cards"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("reportCards.printTitle") }
}

export default function PrintReportCardsPage({
  params,
  searchParams,
}: {
  params: { orgId: string }
  searchParams: { groupId?: string; termId?: string }
}) {
  return <PrintableReportCards orgId={params.orgId} groupId={searchParams.groupId ?? ""} termId={searchParams.termId ?? ""} />
}
