import { getTranslations } from "next-intl/server"
import { AlertTriangle, Clock } from "lucide-react"
import { OrgShell } from "@/components/organizations/org-shell"
import { getOrgContext } from "./_context"

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgId: string }
}) {
  const { org, role } = await getOrgContext(params.orgId)
  const t = await getTranslations("organizations")

  return (
    <OrgShell orgId={org.id} name={org.name} type={org.type} role={role}>
      {!org.isActive ? (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("banner.suspended")}</p>
        </div>
      ) : !org.isApproved ? (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("banner.pending")}</p>
        </div>
      ) : null}
      {children}
    </OrgShell>
  )
}
