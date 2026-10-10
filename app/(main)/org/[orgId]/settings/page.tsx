import { getTranslations } from "next-intl/server"
import { Settings } from "lucide-react"
import { PageHeader } from "@/components/shared"
import { OrgForm } from "@/components/organizations/org-form"
import { requireOrgPage } from "../_context"

export default async function OrgSettingsPage({ params }: { params: { orgId: string } }) {
  const { org, role } = await requireOrgPage(params.orgId, ["OWNER", "MANAGER"])
  const t = await getTranslations("organizations")
  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title={t("settings.title")} description={t("settings.subtitle")} />
      <OrgForm
        canChangeType={role === "OWNER"}
        initial={{
          id: org.id,
          name: org.name,
          type: org.type,
          slug: org.slug,
          description: org.description ?? "",
          phone: org.phone ?? "",
          email: org.email ?? "",
          address: org.address ?? "",
          governorate: org.governorate ?? "",
          logoUrl: org.logoUrl ?? "",
          coverUrl: org.coverUrl ?? "",
          primaryColor: org.primaryColor ?? "#4f46e5",
        }}
      />
    </div>
  )
}
