import { notFound } from "next/navigation"
import { SchoolTabs } from "@/components/school/school-tabs"
import { requireOrgPage } from "../_context"

/** School mode: staff only (owner, managers, teachers), schools only. */
export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgId: string }
}) {
  const { org } = await requireOrgPage(params.orgId, ["OWNER", "MANAGER", "TEACHER"])
  if (org.type !== "SCHOOL") notFound()
  return (
    <div className="min-w-0">
      <SchoolTabs orgId={org.id} />
      {children}
    </div>
  )
}
