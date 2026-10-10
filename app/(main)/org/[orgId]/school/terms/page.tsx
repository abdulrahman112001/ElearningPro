import { getTranslations } from "next-intl/server"
import { TermsManager } from "@/components/school/terms-manager"
import { getOrgContext } from "../../_context"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("terms.title") }
}

export default async function SchoolTermsPage({ params }: { params: { orgId: string } }) {
  const { org, isManager } = await getOrgContext(params.orgId)
  return <TermsManager orgId={org.id} canManage={isManager} />
}
