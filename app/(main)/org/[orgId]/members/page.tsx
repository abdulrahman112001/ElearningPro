import { getTranslations } from "next-intl/server"
import { Users } from "lucide-react"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/shared"
import { MembersManager } from "@/components/organizations/members-manager"
import { requireOrgPage } from "../_context"

export default async function OrgMembersPage({
  params,
  searchParams,
}: {
  params: { orgId: string }
  searchParams: { add?: string }
}) {
  const { org, role, session } = await requireOrgPage(params.orgId, ["OWNER", "MANAGER"])
  const t = await getTranslations("organizations")
  const members = await db.organizationMember.findMany({
    where: { organizationId: org.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      id: true, role: true, joinedAt: true,
      user: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  })
  return (
    <div className="space-y-6">
      <PageHeader icon={Users} title={t("members.title")} description={t("members.subtitle")} />
      <MembersManager
        orgId={org.id}
        viewerRole={role}
        viewerId={session.user.id}
        prefillEmail={typeof searchParams.add === "string" ? searchParams.add.slice(0, 200) : undefined}
        members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))}
      />
    </div>
  )
}
