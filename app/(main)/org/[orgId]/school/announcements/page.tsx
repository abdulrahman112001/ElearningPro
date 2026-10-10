import { getTranslations } from "next-intl/server"
import { AnnouncementsManager } from "@/components/school/announcements-manager"
import { getOrgContext } from "../../_context"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("announcements.title") }
}

export default async function SchoolAnnouncementsPage({ params }: { params: { orgId: string } }) {
  const { org, session } = await getOrgContext(params.orgId)
  return <AnnouncementsManager orgId={org.id} userId={session.user.id} />
}
