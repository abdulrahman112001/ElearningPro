import { getTranslations } from "next-intl/server"
import { Mail } from "lucide-react"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/shared"
import { InvitesManager } from "@/components/organizations/invites-manager"
import { requireOrgPage } from "../_context"

export default async function OrgInvitesPage({ params }: { params: { orgId: string } }) {
  const { org, role } = await requireOrgPage(params.orgId, ["OWNER", "MANAGER"])
  const t = await getTranslations("organizations")
  const invites = await db.organizationInvite.findMany({
    where: { organizationId: org.id, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
  })
  return (
    <div className="space-y-6">
      <PageHeader icon={Mail} title={t("invites.title")} description={t("invites.subtitle")} />
      <InvitesManager
        orgId={org.id}
        canInviteManagers={role === "OWNER"}
        invites={invites.map((i) => ({
          ...i,
          expiresAt: i.expiresAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
