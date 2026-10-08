import { getTranslations } from "next-intl/server"
import { Activity } from "lucide-react"
import { PageHeader } from "@/components/shared"
import { ActivityFeed } from "@/components/admin/activity-feed"

export async function generateMetadata() {
  const t = await getTranslations("adminActivity")
  return { title: t("title") }
}

// Auth/role is enforced by app/(main)/admin/layout.tsx and the API route.
export default async function AdminActivityPage() {
  const t = await getTranslations("adminActivity")
  const ta = await getTranslations("admin")

  return (
    <div>
      <PageHeader
        icon={Activity}
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: ta("adminPanel"), href: "/admin" }, { label: t("title") }]}
      />
      <ActivityFeed />
    </div>
  )
}
